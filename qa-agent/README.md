# Outskill AI Mentor

A production-ready AI question-answering agent for Outskill's live events. When Zoom chat is
disabled during the Free AI Mastermind or the AI Bootcamp, participants open the AI Mentor
and ask unlimited questions — about AI, their careers, their industry, or any Outskill
program — and get instant, personalized, honest answers from a mentor that adapts to who
they are.

Built on **Claude (Anthropic) only** — no LangChain, no OpenAI, no external AI frameworks.
Two runtime dependencies: `express` and `@anthropic-ai/sdk`.

## What it does

- **Answers anything in scope** — AI concepts, tools, agents, automation, careers, salaries
  (honestly), the Mastermind/Bootcamp/Accelerator programs, pricing, EMI, curriculum,
  certificates, refunds.
- **Understands who's asking.** Every message is classified (profession, experience, AI
  familiarity, career stage, market, sentiment, intent, objections, goals) via a
  schema-enforced Claude call, merged into a persistent per-session profile. An HR manager
  asking "how is this useful for me?" hears about resume screening — never about coding.
- **Grounded answers.** Program facts come from a curated knowledge base via BM25 retrieval
  — the agent quotes ₹94,999 exactly or says it will confirm, never guesses.
- **Human-like reasoning, kept internal.** Adaptive thinking on Claude Opus 4.8; chain of
  thought is never exposed.
- **Handles objections honestly.** "I'm not technical", "I'm too old", "AI will replace me",
  "this is expensive" — educate-first answers with hard compliance rails (no job/salary
  guarantees, no invented prices or discounts, ever).
- **Remembers the conversation.** Verbatim recent window + running summary + structured
  profile; long sessions compact automatically off the request path.
- **Premium chat UI.** Streaming responses, typing indicator, dark/light mode, suggested
  questions that adapt to the user's profession, feedback buttons, copy answer, history
  restore, fully responsive. No build step.

## Quick start

```bash
cd qa-agent
npm install
cp .env.example .env      # put your ANTHROPIC_API_KEY in .env
npm start                 # → http://localhost:8787
```

Edit the corpus in `knowledge/`, then `npm run ingest`. Run `npm test` (27 unit/integration
tests, no API key needed) and `npm run eval` (13 golden retrieval cases; `--full` for
end-to-end answer grading with an API key).

## Repository layout

```
qa-agent/
├── server/               backend (Node 20+, ESM)
│   ├── index.js          entrypoint & wiring
│   ├── app.js            Express app: routes, SSE, rate limiting
│   ├── config.js         env-driven configuration
│   ├── prompts/          system.md · profiler.md · summarizer.md · build.js
│   ├── services/         chat orchestrator · profiler · suggestions · anthropic client
│   ├── rag/              parsers → chunker → bm25 → ingest → retriever
│   └── store/            session store (file-backed) · feedback store (JSONL)
├── web/                  static chat UI (HTML/CSS/JS, zero build)
├── knowledge/            the curated corpus — the single source of truth for program facts
├── scripts/              ingest.js (rebuild index) · eval.js (golden-set eval)
├── eval/golden.json      golden questions incl. compliance cases
├── tests/                node:test suite (hermetic — fake Claude client)
└── docs/                 research report · architecture · ADRs · guides (setup,
                          deployment, configuration, maintenance, evaluation, roadmap,
                          prompt design)
```

## Documentation map

| Doc | What's in it |
|---|---|
| `docs/01-research-report.md` | Phase-1 research: support agents, education assistants, RAG survey, memory systems, evaluation methods |
| `docs/02-architecture.md` | Every component, why it exists, request lifecycle, data shapes, cost/latency budget |
| `docs/03-adr/` | Six architecture decision records with alternatives and tradeoffs |
| `docs/04-prompt-design.md` | The prompt system: layers, caching strategy, guardrails, how to change prompts safely |
| `docs/05-setup-guide.md` | Local setup from zero |
| `docs/06-deployment-guide.md` | Production deployment, scaling path, rate-limit sizing |
| `docs/07-configuration-guide.md` | Every environment variable |
| `docs/08-maintenance-guide.md` | Weekly ops loop: knowledge updates, feedback review, prompt changes |
| `docs/09-evaluation.md` | The three evaluation loops and how to extend the golden set |
| `docs/10-roadmap.md` | Future phases |

## Compliance guarantees (encoded in the cached system prompt + regression-tested)

1. Never promises a job, interview, or salary figure.
2. Never invents prices, discounts, or scholarships (none exist).
3. Indian EMI is always presented as zero-cost; the 9% fee is international-installments only.
4. NSDC/Skill India certificate claims are India-only.
5. The AI Engineering Accelerator price is never stated (it isn't public).
6. Payment/refund account issues are escalated to humans.
