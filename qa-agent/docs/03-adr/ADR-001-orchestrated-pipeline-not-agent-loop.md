# ADR-001 — Orchestrated pipeline, not an agent loop

**Status:** Accepted

## Context
Each participant message needs: intent/profile understanding, knowledge retrieval, a
personalized answer, and persistence. We could implement this as (a) a tool-using agent loop
where Claude decides when to search the knowledge base, or (b) a fixed orchestrated pipeline
where the server always profiles, always retrieves, then answers.

## Decision
Fixed orchestrated pipeline (b).

## Rationale
- **Determinism & latency.** An agent loop costs ≥2 model round-trips whenever the model
  elects to search (decide → tool result → answer). The pipeline always pays exactly one
  answer call plus one parallel low-effort profiler call; retrieval is local and ~free.
- **Every question benefits from retrieval.** This is a domain QA product; the corpus is
  small and focused. "Should I search?" has a near-constant answer of yes — delegating that
  decision to the model buys nothing.
- **Debuggability.** With a fixed pipeline, a bad answer decomposes into: bad retrieval
  (inspect chunks), bad profile (inspect profiler JSON), or bad prompting. Agent-loop
  trajectories are harder to regression-test.
- The Claude API guidance itself ("Should I build an agent?") recommends staying at the
  workflow tier when the task is specifiable in advance — ours is.

## Consequences
- Adding genuinely dynamic capabilities later (e.g., live batch-date lookup) means adding an
  explicit pipeline step or introducing tool use for that call only.
- We accept slightly more retrieved-context tokens on messages that didn't strictly need
  retrieval ("thanks!"); a cheap length/intent gate skips retrieval for trivial messages.
