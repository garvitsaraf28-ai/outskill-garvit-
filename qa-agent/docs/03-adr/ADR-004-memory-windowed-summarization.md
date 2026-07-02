# ADR-004 — Memory: structured profile + windowed summarization

**Status:** Accepted

## Context
Sessions can run for hours during an event. Full-history resend grows cost linearly and
eventually overflows; a bare rolling window forgets the crucial early turns ("I'm an HR
manager with zero coding background" is usually message 1).

## Decision
Three-layer memory, all per-session:
1. **Structured profile** (profession, experience, market, objections, goals…) — merged every
   turn by the profiler, re-injected every turn. The highest-value memory, distilled.
2. **Verbatim window** — last 12 messages sent as real conversation turns.
3. **Running summary** — when history exceeds the window + slack, older turns are compacted
   into a summary via a low-effort Claude call, off the request path.

## Alternatives considered
- **Server-side compaction (API beta `compact-2026-01-12`):** attractive, but beta, couples
  us to per-conversation compaction blocks, and doesn't give us the structured profile we
  need for personalization/suggestions anyway. Revisit at GA.
- **Memory tool (`memory_20250818`):** designed for agentic cross-session memory; heavier
  than needed for a single-event chat session.
- **Full-history resend:** simple but cost grows per turn and long sessions degrade quality
  (the model attends to noise).

## Consequences
- Compaction is asynchronous → a crash between response and compaction loses only the
  compaction, not the turns (they're persisted first).
- The profile schema is the contract between profiler, prompt builder, and suggestions —
  versioned in one place (`profiler.js`).
