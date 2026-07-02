# Maintenance Guide

The system is designed around one weekly ops loop that a non-engineer can run, plus a small
engineering surface.

## The weekly loop (30–60 minutes, ideally Monday after the weekend events)

1. **Review feedback.** `data/feedback.jsonl` — every 👍/👎 with session + message IDs.
   Look up the conversation in `data/sessions/<id>.json` for context.
   ```bash
   grep '"rating":"down"' data/feedback.jsonl | tail -50
   ```
2. **Classify each 👎:**
   - *Missing/wrong fact* → fix or add a knowledge doc (step 3).
   - *Found the fact but answered poorly* → prompt tweak (step 4) or new golden case.
   - *Retrieval miss* (right doc exists, wasn't cited in `sources`) → add synonym-rich
     headings or an FAQ phrasing of the question to the corpus.
3. **Update knowledge.** Edit `knowledge/*.md` → `npm run ingest` → restart → spot-check.
   Authoring rules:
   - One topic per heading; question-phrased headings for things people actually ask.
   - State numbers exactly and once (single source of truth per fact — pricing lives in
     `04-pricing-and-payments.md`; other docs may repeat only what's stable).
   - HTML comments (`<!-- -->`) are stripped at ingest — use them for editorial notes.
   - **Before every event:** verify prices, batch dates, schedules against the current
     official sheet.
4. **Prompt changes.** Edit `server/prompts/*.md`, then `npm test` and
   `npm run eval -- --full --tag compliance`. Never remove a compliance rule without sign-off.
5. **Grow the golden set.** Every real failure becomes a case in `eval/golden.json`.

## Adding new document formats

`.md/.txt/.html/.csv` work out of the box. `.pdf`/`.docx`: `npm i pdf-parse mammoth`.
Notion / Google Docs: export to Markdown or HTML and drop into `knowledge/`. Prefer
converting everything to Markdown — heading-aware chunking works best there.

## Data hygiene

- `data/sessions/` grows with usage; sessions carry no PII by design (random IDs, whatever
  the user typed). Cron-clean sessions older than ~30 days:
  `find data/sessions -mtime +30 -delete`
- Back up `data/feedback.jsonl` before cleaning — it's the evaluation asset.

## Monitoring in production

- `/api/health` for liveness + index stats.
- Server log lines worth alerting on: `[profiler] degraded` spikes (model latency/limits),
  `[chat] answer failed` (API errors/rate limits), 429 rates.
- Token spend: the `done` SSE event carries per-message usage (incl. cache hit split) —
  aggregate it in your log pipeline; a healthy steady state shows large `cacheRead` values.

## Incident quick-reference

| Symptom | First move |
|---|---|
| Every answer errors | Check API key validity + Anthropic status page; check rate-limit headroom |
| Slow answers | Check `cacheRead` in usage — zero means the system prompt cache is being invalidated (was `system.md` just changed? multiple app versions running?) |
| Wrong program facts | `knowledge/` fix + ingest — never patch prompts with facts |
| Users report "it forgot what I said" | Inspect the session file: profile fields + summary; if the profiler misclassifies systematically, tighten `profiler.md` |
