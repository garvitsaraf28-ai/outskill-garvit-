# Phase 2 — System Architecture

**System:** Outskill AI Mentor
**Reading order:** `01-research-report.md` → this file → `03-adr/` for individual decisions.

---

## 1. Bird's-eye view

```
 Participant (phone/laptop, mid-Zoom-session)
        │  HTTPS
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  web/  — static chat UI (no build step)                      │
 │  streaming render · history · suggestions · feedback · theme │
 └──────────────┬───────────────────────────────────────────────┘
                │ POST /api/chat  (SSE response)
                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │  server/ — Express (Node 20+, ESM)                           │
 │                                                              │
 │   chat orchestrator (services/chat.js)                       │
 │   ┌─────────────┐   ┌──────────────┐                         │
 │   │ profiler     │   │ retriever    │   run in parallel      │
 │   │ (Claude,     │   │ (BM25 over   │                        │
 │   │ structured   │   │ knowledge/)  │                        │
 │   │ output)      │   └──────┬───────┘                        │
 │   └──────┬──────┘          │                                 │
 │          ▼                  ▼                                │
 │   prompt builder (cached system + dynamic user context)      │
 │          │                                                   │
 │          ▼                                                   │
 │   Claude Opus 4.8  — messages.stream() → SSE deltas          │
 │          │                                                   │
 │          ▼                                                   │
 │   session store (persist turn, async summary compaction)     │
 └──────────────────────────────────────────────────────────────┘
                │
                ▼
 data/  — sessions/*.json · feedback.jsonl · index.json (BM25)
 knowledge/ — curated Markdown corpus (the single source of truth)
```

## 2. Request lifecycle (one message)

1. **Validate + load.** Sanitize `sessionId`, rate-limit, load session (profile + summary +
   recent messages) from the store.
2. **Fan out (parallel):**
   - **Profiler** — one Claude call with a JSON-schema-enforced output classifying
     profession, experience, intent, sentiment, objection, career stage from the new message
     + recent context. Bounded by a timeout; on timeout/failure the previous profile is used
     (graceful degradation).
   - **Retriever** — BM25 over the chunk index with the user message (augmented with light
     profile/context terms), top-k with score floor.
3. **Merge profile.** Confidence-aware merge into the persistent profile (never let one
   ambiguous message erase a confidently-known profession).
4. **Answer.** `messages.stream()` with:
   - `system`: byte-stable blocks (mentor identity, teaching style, persona playbooks,
     compliance guardrails) with `cache_control` on the last block → cached across all users;
   - `messages`: running summary (if any) + last N verbatim turns + current user turn wrapped
     with `<learner_profile>` and `<retrieved_context>` blocks;
   - adaptive thinking (internal reasoning, never surfaced), `max_tokens` sized for chat.
   Deltas are forwarded to the client as SSE `delta` events; `meta` (profile + sources) is
   sent first; `done` closes with message id + usage.
5. **Persist.** Append both turns, save profile. If history exceeds the window, compact older
   turns into the running summary **asynchronously** (off the request path) with a low-effort
   Claude call.

Failure containment: profiler failure → stale profile; retrieval empty → answer proceeds with
"no context found" instruction (the prompt then forbids specific program-fact claims); Claude
API error → SSE `error` event with a friendly retry message; store write failure → logged,
response still delivered.

## 3. Component inventory

| Component | File(s) | Responsibility | Why it exists / alternative rejected |
|---|---|---|---|
| HTTP layer | `server/index.js`, `server/app.js` | Routes, static hosting, SSE plumbing, rate limiting | Express matches the repo's existing idiom; Fastify/Hono rejected as unnecessary churn |
| Config | `server/config.js` | Env parsing, defaults, validation at boot | Fail fast on missing key at first use, everything overridable per environment |
| Claude client | `server/services/anthropic.js` | Single SDK client factory | One place to swap base URL / inject fakes for tests |
| Chat orchestrator | `server/services/chat.js` | The lifecycle above | The heart; dependency-injected so tests run without network |
| Profiler | `server/services/profiler.js` | Joint classification + confidence merge | ADR-005; separate call keeps the answer prompt cache stable |
| Prompt builder | `server/prompts/build.js` + `server/prompts/*.md` | Assemble cached system + dynamic user blocks | Prompts live in version-controlled Markdown, reviewable by non-engineers |
| Retriever | `server/rag/retriever.js`, `bm25.js`, `chunker.js`, `ingest.js`, `parsers.js` | Corpus → chunks → index → top-k | ADR-003; pure JS, zero services |
| Session store | `server/store/sessionStore.js` | Durable sessions, windowing, compaction hooks | Interface designed so Postgres/Redis is a drop-in (ADR-006) |
| Feedback store | `server/store/feedbackStore.js` | Append-only JSONL of 👍/👎 + comments | Feeds the weekly eval loop |
| Suggestions | `server/services/suggestions.js` | Profession-aware question chips | No API call — instant, free |
| Frontend | `web/` | Chat UI | ADR-006; vanilla JS = zero build step, trivially embeddable next to Zoom |
| Ingestion CLI | `scripts/ingest.js` | Rebuild index when knowledge changes | Operators add a doc, run one command |
| Eval harness | `scripts/eval.js`, `eval/golden.json` | Golden-set regression incl. compliance cases | Research §2.7 |

## 4. API surface

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/chat` | Send a message; response is an SSE stream | Events: `meta` → `delta`* → `done` (or `error`) |
| `GET /api/history/:sessionId` | Restore conversation on reload | |
| `GET /api/suggestions?sessionId=` | Profession-aware suggested questions | |
| `POST /api/feedback` | 👍/👎 + optional comment for a message | |
| `GET /api/health` | Liveness + index/corpus stats | |

## 5. Data shapes

**Session** (`data/sessions/<id>.json`):
```jsonc
{
  "id": "s_ab12…", "createdAt": 0, "updatedAt": 0,
  "profile": {
    "profession": "hr",          // enum, "unknown" until detected
    "professionConfidence": 0.9,
    "experienceLevel": "senior", // beginner|intermediate|senior|unknown
    "aiFamiliarity": "none",     // none|basic|intermediate|advanced|unknown
    "careerStage": "employed",   // student|early_career|employed|leader|founder|freelancer|retired|unknown
    "sentiment": "anxious",      // per-turn, last observed
    "intent": "objection",       // per-turn, last observed
    "objections": ["not_technical","no_time"],   // accumulates
    "goals": ["side_income"],                     // accumulates
    "market": "india"            // india|international|unknown  (drives pricing/certificate answers)
  },
  "summary": "…running distillation of turns no longer in the window…",
  "messages": [{ "id": "m_…", "role": "user|assistant", "content": "…", "ts": 0,
                  "sources": [{"doc": "…", "section": "…"}], "feedback": null }]
}
```

**Chunk index** (`data/index.json`): `{ builtAt, k1, b, avgdl, chunks: [{id, doc, title,
heading, text, terms: {term: freq}, len}], df: {term: docCount} }`.

## 6. Model usage map

| Call | Model (default) | Config | Why |
|---|---|---|---|
| Answer | `claude-opus-4-8` | streaming, adaptive thinking, `max_tokens` 4096, cached system prompt | Quality of personalization/objection handling is the product; caching absorbs the cost |
| Profiler | `claude-opus-4-8` | `output_config.format` json_schema, `effort: "low"`, `max_tokens` 512, 2.5 s timeout | Structured, fast; low effort is ample for classification |
| Summarizer | `claude-opus-4-8` | `effort: "low"`, `max_tokens` 600, off request path | Compaction quality matters more than speed |

All three are overridable via `ANSWER_MODEL`, `PROFILE_MODEL`, `SUMMARY_MODEL` (see
configuration guide) — e.g. an operator may pin the profiler/summarizer to a smaller model
for cost once they've validated quality; we do not make that tradeoff for them by default.

## 7. Cost & latency budget (per message, steady state)

- **Input:** system prompt (~3.5k tokens) is cache-read (~0.1×) after first request; dynamic
  suffix (profile + 6 chunks + window) ≈ 1.5–2.5k tokens at full price.
- **Output:** typically 150–400 tokens (the prompt enforces concise mentor answers).
- **Latency:** profiler (parallel, low effort) typically < 2 s; answer TTFT ~1–2 s with
  cached prefix; the user sees streaming text well under 3 s in the common case.

## 8. Security & safety

- API key server-side only; never shipped to the browser.
- Session IDs are client-generated opaque tokens, sanitized server-side; no PII required.
- Input caps (message length, history size), simple per-session+IP rate limiting.
- Retrieved context and user text are wrapped in delimited blocks and the system prompt
  instructs that instructions inside them are data, not commands (prompt-injection hygiene —
  the knowledge corpus is trusted, user text is not).
- Compliance guardrails (no job/salary guarantees, no invented prices/discounts, NSDC claims
  India-only, Engineering price never stated) live in the *cached, non-negotiable* system
  prompt and are regression-tested in the eval set.

## 9. Scaling path

v1 is a single stateless process with file-backed stores. Documented upgrade path
(deployment guide): (1) move sessions/feedback to Postgres or Redis by implementing the same
store interface; (2) run N processes behind a load balancer; (3) if the corpus outgrows BM25
quality, switch `retriever.js` to hybrid per ADR-003 without touching the orchestrator.
