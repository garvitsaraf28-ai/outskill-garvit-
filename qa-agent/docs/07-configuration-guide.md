# Configuration Guide

All configuration is environment variables (or a flat `.env` file in `qa-agent/`, loaded at
boot; real env vars win). Defaults are production-sensible.

| Variable | Default | What it controls |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key (recommended provider). Never reaches the browser. |
| `OPENROUTER_API_KEY` | — | **Free mode:** used only when no Anthropic key is set. Runs the app on OpenRouter's `:free` models (openrouter.ai/keys, no card; ~50 req/day). Good for demos/testing; noticeably weaker on objection nuance and compliance discipline than Claude — use Claude for real events. |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Free-mode model. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Free-mode endpoint override (used by tests). |
| `PORT` | `8787` | HTTP port. |
| `ANSWER_MODEL` | `claude-opus-4-8` | Model for user-facing answers. |
| `PROFILE_MODEL` | `claude-opus-4-8` | Model for the structured-output profiler. |
| `SUMMARY_MODEL` | `claude-opus-4-8` | Model for background history compaction. |
| `ANSWER_MAX_TOKENS` | `4096` | Output cap per answer (includes adaptive-thinking tokens). |
| `PROFILE_TIMEOUT_MS` | `2500` | Profiler deadline; on expiry the previous profile is used. |
| `HISTORY_WINDOW` | `12` | Verbatim turns kept in context; older turns get summarized. |
| `RETRIEVE_K` | `6` | Chunks injected per answer. |
| `RATE_LIMIT_PER_MIN` | `20` | Messages per session+IP per minute. |
| `MAX_MESSAGE_CHARS` | `4000` | Input length cap. |
| `KNOWLEDGE_DIR` | `qa-agent/knowledge` | Corpus location. |
| `DATA_DIR` | `qa-agent/data` | Index, sessions, feedback. Point at a persistent volume in prod. |

## Tuning notes

- **Cost lever #1 — profiler/summarizer model.** ADR-002 defaults everything to Opus 4.8.
  Once you've validated classification quality on your own traffic (run
  `npm run eval -- --full` before and after), setting `PROFILE_MODEL=claude-haiku-4-5` and
  `SUMMARY_MODEL=claude-haiku-4-5` cuts the per-message overhead substantially with usually
  negligible profile-quality impact.
- **Latency lever — `PROFILE_TIMEOUT_MS`.** Lower = snappier worst case, more turns answered
  with a one-turn-stale profile. 1500–3000ms is the sensible band.
- **Quality lever — `RETRIEVE_K`.** 4–8. More chunks = more grounding + more input tokens.
- **`HISTORY_WINDOW`** trades context fidelity vs input cost; compaction picks up whatever
  falls out of the window, in batches of 8+.
- **Model migration:** change the three model vars, run `npm test` and
  `npm run eval -- --full`, done. Model IDs appear nowhere else in the code.
