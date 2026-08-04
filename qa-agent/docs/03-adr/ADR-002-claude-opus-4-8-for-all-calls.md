# ADR-002 — Claude Opus 4.8 for all model calls (env-overridable)

**Status:** Accepted

## Context
Three call types: answer (streaming, user-facing), profiler (structured classification),
summarizer (background compaction). The product constraint is Anthropic-only.

## Decision
Default all three to `claude-opus-4-8`. Expose `ANSWER_MODEL`, `PROFILE_MODEL`,
`SUMMARY_MODEL` env overrides.

## Rationale
- Current Anthropic guidance (bundled Claude API reference, June 2026): default to
  `claude-opus-4-8` unless the operator explicitly chooses otherwise; do not silently
  downgrade tiers for cost.
- Answer quality *is* the product: nuanced objection handling, tone-matching an anxious
  finance manager vs. a skeptical engineer, and strict factual discipline. Opus-tier is the
  right default.
- The profiler and summarizer run at `effort: "low"` with small inputs/outputs, so the cost
  delta of Opus vs. a smaller model is small in absolute terms; correctness of the profile
  compounds across the whole session.
- Prompt caching (system prefix cached, ~0.1× on reads) absorbs the bulk of answer-call
  input cost.

## Alternatives considered
- Haiku 4.5 for profiler/summarizer: legitimate cost optimization; left to the operator via
  env override after they validate classification quality on their traffic (see
  configuration guide), rather than made a silent default.
- Sonnet-tier for answers: cheaper, but tone/compliance nuance is exactly where tiers differ.

## Consequences
- Cost is documented and monitorable (usage logged per call); operators have one-line levers.
- Model IDs live in config only — a future model migration is a config change plus eval run.
