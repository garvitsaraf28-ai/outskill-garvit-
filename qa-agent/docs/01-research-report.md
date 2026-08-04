# Phase 1 — Research Report

**Project:** Outskill AI Mentor — a question-answering agent for live Mastermind & Bootcamp sessions
**Author:** Founding engineering (AI systems)
**Status:** Complete — findings feed directly into `02-architecture.md`

---

## 1. Problem restatement (what we are actually solving)

During Outskill's free AI Masterminds (Sat/Sun Generalist; Fri/Sat Engineering) and paid
Bootcamps, Zoom chat is disabled once spam appears. From that moment, thousands of
participants have no way to ask questions. The observable damage:

- **Confusion compounds.** A participant who loses the thread at minute 40 is lost for the
  remaining hours.
- **Objections harden.** "This is too technical for me" left unanswered at the event becomes
  "I didn't enroll" a week later.
- **Sales context evaporates.** The events pitch the AI Generalist Accelerator; every
  unanswered "is this for HR people?" is a lost enrollment conversation.

The system must therefore be three things at once: a **teaching assistant** (explain AI
concepts at the asker's level), a **program counselor** (accurate program/pricing/logistics
answers), and an **objection handler** (honest, educate-first responses to fear and
skepticism). It must survive **weekend-scale bursts** (thousands of concurrent users for
~12–14 hours, then near-zero traffic on weekdays).

## 2. What we studied

We reviewed the publicly documented architectures and postmortems of the systems closest to
this problem, plus Anthropic's current API surface (via the maintained Claude API reference
bundled with Claude Code, cached June 2026 — our source of truth for model IDs, streaming,
prompt caching, structured outputs, and adaptive thinking).

### 2.1 Enterprise support agents (Intercom Fin, Zendesk AI, Decagon, Sierra)

Common properties across every production support agent we studied:

| Property | Consensus pattern | Our takeaway |
|---|---|---|
| Grounding | RAG over a curated help-center corpus; answers must cite/derive from retrieved passages | Non-negotiable. Program facts (₹94,999, zero-cost EMI, NSDC certificate) must come from a knowledge base, never model memory. |
| Hallucination control | "Answer only from context; otherwise say you'll confirm" + hard rules for prices/legal claims | We encode this as prompt guardrails + a curated facts corpus. |
| Escalation | Detect what the bot must not do (refund disputes, payment failures) and hand off | We add an explicit escalation contract in the system prompt. |
| Persona | One stable brand voice, tuned in the system prompt, never per-message | One "senior Outskill mentor" voice. |
| Feedback loop | Thumbs up/down per answer feeding an offline review queue | We ship 👍/👎 + JSONL feedback log from day one. |

Key negative lesson (Air Canada chatbot ruling, 2024; DPD chatbot incident): a company is
liable for what its bot promises. Hence two hard compliance rules inherited from Outskill's
own sales-training material: **never promise a job or specific salary; never invent a price,
discount, or scholarship.**

### 2.2 AI education assistants (Khanmigo, Duolingo Max, Harvard CS50 bot)

- **Level-matching beats content-dumping.** Khanmigo's core trick is inferring learner level
  and answering *at* that level. Our equivalent: a per-session learner profile (profession,
  experience, sentiment) that conditions every answer.
- **Socratic ≠ always right.** CS50's bot found that for logistics questions, direct answers
  win; Socratic style is for concept questions. We mirror that: intent classification routes
  between "explain like a teacher" and "answer like a counselor."
- **Suggested questions drive engagement.** Cold-start users don't know what to ask.
  Profession-aware suggestion chips measurably increase first-message rate.

### 2.3 RAG architecture survey

We compared four retrieval families for a corpus of our shape (~10–50 curated documents,
heavily factual, updated weekly):

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Dense vector search** (embeddings + vector DB) | Best paraphrase recall on large corpora | Requires an embedding provider (Anthropic ships none first-party → adds Voyage/other vendor), a vector store, index ops | Overkill at our corpus size; adds a second AI vendor against the "Claude only" constraint |
| **Lexical BM25** (Okapi) | Zero external deps, deterministic, debuggable, excellent on keyword-heavy factual corpora (prices, program names, tool names) | Weaker on pure paraphrase | **Chosen.** At ≤ a few thousand chunks, BM25 + good chunking + query augmentation is within a few points of dense retrieval on factual QA — and our queries are keyword-rich ("EMI", "price", "certificate", "n8n") |
| Hybrid (BM25 + dense, reciprocal-rank fusion) | Best quality | All the dense costs plus fusion tuning | Documented as the upgrade path (ADR-003), not v1 |
| Long-context stuffing (entire corpus in prompt) | No retrieval failure modes | Cost per message scales with corpus; slower TTFT; corpus will outgrow it | Rejected for the request path; **but** we exploit prompt caching to keep the *stable* part of the prompt near-free |

Supporting evidence: BEIR benchmark results consistently show BM25 as a strong baseline that
dense models only clearly beat at scale and on paraphrase-heavy workloads; production
writeups (e.g. Stack Overflow's OverflowAI, GitHub Copilot docs search) use lexical or hybrid
first stages. For a 50-document curated corpus, retrieval quality is dominated by **chunking
and corpus curation**, not by the ranking function.

**Chunking finding:** heading-aware chunking (split on Markdown headings, merge tiny
sections, ~200–400 words/chunk, metadata = doc title + heading path) outperforms fixed-size
sliding windows on curated docs, because authors already organized facts by topic.

### 2.4 Conversational memory systems

Patterns evaluated: full-history resend (simple, grows unbounded), rolling window (loses
early context — bad: the user's profession is often stated in message 1), server-side
compaction (Claude API beta — powerful but beta and per-conversation), and **windowed
summarization** (keep last N turns verbatim; distill older turns into a running summary).

Chosen: **windowed summarization + structured profile.** The profile (profession, experience,
intent, objections raised) is itself the highest-value memory — it's distilled, structured,
and cheap to re-inject every turn. The summary catches everything else. This is the same
shape ChatGPT's memory and Anthropic's own memory-tool guidance converge on: *structured
distillation beats raw transcript retention.*

### 2.5 User profiling & intent classification

- Single **structured-output** classification call (JSON schema enforced by the API) is more
  reliable than prompt-and-pray JSON, and cheaper/faster than an agent loop. The Claude API's
  `output_config.format` (json_schema) guarantees parseable output.
- Classify **jointly** (profession + experience + intent + sentiment + objection + career
  stage in one call) — the fields are correlated, and one call halves latency vs. chained
  classifiers.
- **Merge, don't overwrite:** each turn's classification updates a persistent profile with
  confidence rules (never downgrade a confidently-known profession because one message was
  ambiguous).
- Emotional intent matters as much as topical intent: "will AI replace me?" from an anxious
  HR manager needs reassurance-first framing; the same words from a skeptical engineer need
  evidence-first framing. Our schema captures sentiment separately from intent.

### 2.6 Prompt engineering findings (current Claude generation)

From the maintained Claude API reference (authoritative over training priors):

1. **Adaptive thinking** (`thinking: {type: "adaptive"}`) replaces manual thinking budgets on
   Opus 4.8; reasoning is internal and never shown — this natively satisfies "reasoning must
   remain internal, never expose chain of thought."
2. **Prompt caching is a prefix match.** Stable content (system prompt, persona playbooks,
   compliance rules) must be byte-stable and come first, with `cache_control` on the last
   static block; volatile content (profile, retrieved chunks, user message) goes in the user
   turn. This makes our large system prompt ~10× cheaper after the first request and cuts
   TTFT.
3. **Structured outputs** via `output_config.format` for the profiler; assistant prefill is
   removed on current models, so schema enforcement is the correct tool.
4. Current models follow instructions **literally** — guardrails should be precise
   ("never state a number for the Engineering Accelerator price; say you'll confirm") rather
   than emphatic ("NEVER EVER make up prices!!!").
5. **Streaming SSE** is required for perceived latency; `messages.stream()` +
   `finalMessage()` is the supported pattern.

### 2.7 Evaluation methods

Production QA agents converge on three loops:
1. **Offline golden set** — curated Q→expected-facts pairs run against the pipeline; assert
   retrieval hit and fact presence (string/regex level), optionally LLM-graded.
2. **Online feedback** — per-answer 👍/👎 with optional comment, reviewed weekly; negative
   feedback becomes new golden cases or knowledge-base fixes.
3. **Compliance spot-checks** — adversarial prompts ("guarantee me a job", "give me a
   discount") asserted to produce compliant refusals.

We ship (1) as `scripts/eval.js`, (2) as the feedback API + JSONL log, (3) as golden cases
tagged `compliance` in the eval set.

## 3. Constraint analysis: "Claude Code / Claude only, no frameworks"

- **No LangChain/LlamaIndex:** justified beyond the stated preference — our pipeline is a
  fixed 4-step orchestration (profile → retrieve → answer → persist). Frameworks add
  abstraction over exactly this, at the cost of debuggability and version churn. Direct SDK
  calls are fewer lines than the framework configuration would be.
- **No OpenAI / no second AI vendor:** rules out first-party embeddings (Anthropic doesn't
  ship an embeddings endpoint) → reinforces the BM25 decision.
- **Lightweight:** Node 20+ (matches the existing repo), two runtime deps (`express`,
  `@anthropic-ai/sdk`), no build step for the frontend, file-backed persistence with an
  interface that upgrades to Postgres/Redis without touching business logic.

## 4. Scale envelope

Weekend event: assume 5,000 concurrent attendees, 10% active in the agent at peak, ~1
message/user/2min → ~4 messages/sec sustained, bursts to ~20/sec. Implications:

- The Node process handles this trivially (I/O-bound; each request is 1–2 Claude calls).
- The real ceiling is the **Anthropic rate limit tier** — documented in the deployment guide
  with the math to size it.
- Prompt caching keeps the per-message input cost dominated by the (small) dynamic suffix.
- Stateless app + file/DB-backed sessions → horizontal scaling is a load balancer away
  (sticky sessions or shared store; documented in deployment guide).

## 5. Decisions carried into Phase 2

1. Single-turn orchestrated pipeline (not an agent loop) — deterministic, fast, debuggable. (ADR-001)
2. Claude Opus 4.8 (`claude-opus-4-8`) for answers *and* profiling; models env-configurable. (ADR-002)
3. BM25 heading-aware RAG, pure JS, pluggable retriever interface. (ADR-003)
4. Windowed summarization + structured profile for memory. (ADR-004)
5. Structured-output joint profiler. (ADR-005)
6. Express + vanilla-JS frontend, no build step; file-backed stores behind interfaces. (ADR-006)
7. Compliance guardrails as first-class prompt sections + eval cases (jobs/salary, prices,
   Engineering-price unknown, NSDC-is-India-only, escalation).
