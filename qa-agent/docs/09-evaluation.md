# Evaluation

Three loops, per the research report (§2.7).

## 1. Offline golden set (`eval/golden.json` + `scripts/eval.js`)

Each case: a question, the docs retrieval must hit, regexes the answer must (not) match, and
tags (`facts`, `compliance`, `objections`, `personalization`).

- `npm run eval` — **retrieval-only** (free, no key, CI-friendly): asserts the expected doc
  is in the top-k. Run on every knowledge or chunker change.
- `npm run eval -- --full` — **end-to-end** (real API calls): runs the full
  profile→retrieve→answer pipeline and greps the streamed answer. Run before every deploy
  and before every weekend event.
- `npm run eval -- --full --tag compliance` — the fast pre-ship safety check (job
  guarantees, discounts, Engineering price, NSDC geography).

Regexes are deliberately mechanical — they catch the failures that matter most (wrong
number, forbidden promise) without grader drift. Extend by appending cases; every real-world
failure from the feedback loop should land here.

## 2. Online feedback loop

👍/👎 (+ optional comment) per answer → `data/feedback.jsonl` → weekly triage (maintenance
guide). Metrics worth tracking week over week: feedback rate, 👎 share, 👎 share by
retrieved-doc (localizes corpus problems).

## 3. Unit/integration suite (`npm test`)

27 hermetic tests (fake Claude client): BM25 ranking, chunker behavior, profile merge rules,
store round-trips and path-traversal rejection, prompt-contract markers (compliance rules
present, cache_control set), full orchestrator turns including degradation paths (profiler
down, answer call down, trivial-message short-circuit).

## Extending to LLM-graded evals (when ready)

The harness already streams full answers per case; add a grader call per case with a rubric
(personalization: "does the answer use the asker's profession?", tone: "is it reassuring
without overpromising?") and a `claude-opus-4-8` judge. Keep the regex layer — graders
supplement, never replace, mechanical compliance checks.
