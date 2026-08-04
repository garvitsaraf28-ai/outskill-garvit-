# ADR-005 — Joint user profiling via one structured-output call

**Status:** Accepted

## Context
Personalization requires knowing profession, experience, AI familiarity, career stage,
market (India vs international — it changes pricing and certificate answers), emotional
sentiment, topical intent, and active objections. Options: heuristics/regex, several small
classifier calls, one joint call, or folding classification into the answer call.

## Decision
One Claude call per user message with `output_config.format` (json_schema, enums for every
categorical field, confidence for profession), `effort: "low"`, hard timeout, running in
parallel with retrieval. Results merge into the persistent profile with
confidence/accumulation rules (objections and goals accumulate; profession only upgrades on
higher confidence; market never flips on low confidence).

## Rationale
- **Joint beats chained:** the fields are correlated ("I'm a CA in Mumbai" answers
  profession, market, and likely experience at once); one call is faster and cheaper than
  five.
- **Schema-enforced JSON** eliminates parse failures (the API validates against the schema) —
  strictly better than prompt-and-parse.
- **Separate from the answer call** so the big cached system prompt stays byte-stable
  (folding a JSON-classification instruction into the answer prompt would pollute it and
  couple two concerns), and so the answer can *condition on* the fresh profile.
- **Timeout + stale-profile fallback** keeps the profiler off the critical path's worst case.

## Consequences
- +1 model call per message (low effort, ~512 max tokens) — measured and logged.
- The schema is intentionally coarse (enums, not free text) except `goals`/`objections`
  slugs; coarse profiles are more stable and are all the prompt needs.
