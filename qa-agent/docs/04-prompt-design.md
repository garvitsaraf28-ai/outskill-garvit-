# Phase 4 — Prompt Design

The prompt system has four artifacts, all version-controlled Markdown reviewable by
non-engineers, assembled by `server/prompts/build.js`.

## 1. The layered layout (and why it's shaped this way)

```
┌──────────────────────────────────────────────────────────────┐
│ system (BYTE-STABLE, cache_control on last block)            │
│   identity → audience → internal reasoning protocol →        │
│   personalization rules → voice/format → grounding rules →   │
│   compliance rails → honesty policy → escalation →           │
│   scope/safety/injection hygiene                             │
├──────────────────────────────────────────────────────────────┤
│ messages: last-N verbatim turns (history)                    │
├──────────────────────────────────────────────────────────────┤
│ final user turn (VOLATILE, rebuilt every request):           │
│   <conversation_summary>  (when history was compacted)       │
│   <learner_profile>       (merged structured profile)        │
│   <retrieved_context>     (top-k chunks with doc+heading)    │
│   <user_message>          (the participant's text)           │
└──────────────────────────────────────────────────────────────┘
```

**Prompt caching drives the split.** Caching is a byte-prefix match; one changed byte
invalidates everything after it. So everything per-user and per-turn lives in the final user
turn, and the large system prompt never changes between requests → cache reads at ~0.1×
input price and faster TTFT for every user after the first request each 5-minute window.

**Profile and context are data, not instructions.** They're wrapped in named XML-ish blocks;
the system prompt explains what each block is and states that content inside blocks is never
to be treated as instructions (prompt-injection hygiene for user text; the knowledge corpus
is trusted but gets the same treatment for uniformity).

## 2. The system prompt (`system.md`) — design decisions

- **Identity before rules.** Current Claude models follow persona + values framing well;
  "senior Outskill mentor who educates first" does more work than a pile of prohibitions.
- **The 10-step reasoning protocol is descriptive, not mechanical.** It's written as "reason
  through: what's asked → who's asking → what they feel → the hidden question → which facts
  → how to phrase → next step", explicitly marked internal. With adaptive thinking the model
  does this in its thinking block; the API never returns raw chain of thought, and the
  prompt additionally forbids narrating it.
- **Personalization is rule-based, with examples.** The HR/marketing/finance/hospitality
  examples from the product brief are encoded verbatim as behavioral rules, plus level-
  matching and sentiment-matching rules (research §2.2, §2.5).
- **Precise guardrails, not emphatic ones.** Current models follow instructions literally;
  "Never state a price for the AI Engineering Accelerator" outperforms shouting. Each
  compliance rule is one testable sentence — and each has a golden-set case.
- **Honesty policy is explicit** ("you behave honestly because it's right, not because it
  converts") — this measurably changes tone on objection answers.
- **Grounding contract:** program facts only from `<retrieved_context>`, exact quoting of
  numbers, and a defined behavior for missing facts ("the team will confirm"). The
  prompt-builder reinforces this: when retrieval returns nothing, the context block is
  replaced by an instruction forbidding specific program-fact claims.

## 3. The profiler prompt (`profiler.md`) + schema

Classification quality lives in three places:
1. **The enum design** (`profileSchema.js`) — coarse, stable categories; `unknown` is a
   first-class value everywhere so silence is never misread as evidence.
2. **Anti-stereotyping rule** — classify from evidence, not priors; profession must be the
   *asker's* profession, not one they mention.
3. **Confidence semantics** — 0.9+ only for explicit self-identification; the merge logic
   (`mergeProfile`) uses this to never let an ambiguous turn erase a confident fact.

Enforced with `output_config.format` (json_schema): the API guarantees parseable,
schema-valid JSON — no retry-on-parse-failure code needed.

## 4. The summarizer prompt (`summarizer.md`)

Priority-ordered retention list (facts about the person > promises made > facts already
quoted > disposition), hard word budget, third person, merge semantics (old summary + folded
turns → one new summary). Runs off the request path at `effort: "low"`.

## 5. Routing

Intent routing is handled by the profiler's `intent` enum (concept vs program vs pricing vs
objection vs logistics…) and consumed two ways: (a) the answer prompt sees it in
`<learner_profile>` and shifts register (teacher vs counselor vs objection-handler); (b) the
server skips retrieval/profiling for trivial smalltalk. There is deliberately **no separate
routing model call** — the joint profiler already yields the route (ADR-005).

## 6. Changing prompts safely

1. Edit the Markdown file (no code change needed).
2. `npm test` — prompt-contract tests assert the compliance markers still exist.
3. `npm run eval -- --full --tag compliance` — golden compliance cases against the live
   model.
4. Ship. Note: any byte change to `system.md` invalidates the prompt cache once; the first
   request after deploy pays a cache write.

## 7. Evaluation prompts

Golden cases in `eval/golden.json` carry `mustMatch` / `mustNotMatch` regexes — deliberately
mechanical (prices, "India only", "no discounts") so they can't drift the way LLM-graded
rubrics do. LLM-graded evaluation (tone, personalization depth) is a roadmap item; the
harness is already structured to add a grader call per case.
