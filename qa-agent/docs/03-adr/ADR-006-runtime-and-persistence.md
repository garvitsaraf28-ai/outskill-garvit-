# ADR-006 — Node/Express + vanilla-JS frontend + file-backed stores behind interfaces

**Status:** Accepted

## Context
The host repo is Node ESM + Express + Vercel-style deployment. The product must be simple to
run, embed, and maintain by a small team.

## Decision
- **Backend:** Node ≥ 20, ESM, Express 4, exactly two runtime deps (`express`,
  `@anthropic-ai/sdk`). App assembled by a `createApp(deps)` factory — every external
  effect (Claude client, stores, retriever, clock) is injected, so tests run hermetically.
- **Frontend:** static `web/` (HTML + CSS + vanilla JS), served by the same Express process.
  No React/Vite for a single-screen chat: zero build step, instant load on event-day mobile
  networks, trivially embeddable via `<iframe>` or a link in the Zoom description.
- **Persistence:** JSON-file session store and JSONL feedback store implementing narrow
  interfaces (`get/put/appendMessage`, `append`). Atomic writes (tmp + rename), in-memory
  read-through cache.

## Alternatives considered
- **TypeScript:** better types, but adds a build step to a codebase whose host repo is JS;
  the surface is small and covered by tests. Revisit if the team grows.
- **SQLite (better-sqlite3 / node:sqlite):** native-build friction / still-stabilizing API
  respectively; file JSON is sufficient at v1 volumes and the interface makes Postgres a
  drop-in later.
- **Next.js/React frontend:** justified only when the UI outgrows one screen.

## Consequences
- Horizontal scaling requires moving the stores to a shared backend first (interface exists;
  documented in the deployment guide).
- File stores are process-local: run one instance until the store swap.
