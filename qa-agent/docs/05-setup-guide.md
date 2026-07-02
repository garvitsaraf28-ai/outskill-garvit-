# Setup Guide

## Prerequisites

- Node.js **20 or newer** (`node -v`)
- An Anthropic API key — create one at https://console.anthropic.com

## Steps

```bash
cd qa-agent
npm install                 # installs express + @anthropic-ai/sdk
cp .env.example .env        # then edit .env and set ANTHROPIC_API_KEY
npm start
```

Open http://localhost:8787. The first boot builds the retrieval index from `knowledge/`
automatically (also rebuildable any time with `npm run ingest`).

## Verify the install

```bash
npm test          # 27 tests, hermetic (no API key, no network)
npm run eval      # 13 golden retrieval checks (no API key)
npm run eval -- --full    # full answer-quality eval (uses your API key, makes real calls)
curl localhost:8787/api/health
```

Expected health response: `{"ok":true,"index":{"docs":10,"chunks":~60,...}}`.

## First conversation

Ask, in order, and watch the personalization engage:
1. "I'm an HR manager with zero coding background — is this for me?"
2. "How much does it cost?"  → should quote ₹94,999 / $2,995 exactly and mention zero-cost
   EMI (India).
3. "Can you guarantee me a better job?" → should decline to guarantee, honestly.

## Adding knowledge

Drop `.md` (preferred), `.txt`, `.html`, or `.csv` files into `knowledge/` and run
`npm run ingest`, then restart. For `.pdf` / `.docx` sources install the optional parsers
first: `npm i pdf-parse mammoth`. Notion and Google Docs: export as Markdown/HTML and drop
the export in. Authoring guidance is in the maintenance guide.

## Common issues

| Symptom | Cause / fix |
|---|---|
| Chat shows "I hit a snag answering that" | Missing/invalid `ANTHROPIC_API_KEY` — check server log |
| Boot warning about ANTHROPIC_API_KEY | Same; UI loads but model calls will fail |
| New knowledge not reflected | Run `npm run ingest` (or delete `data/index.json`) and restart |
| 429 "Too many messages" | Per-session rate limit (default 20/min) — raise `RATE_LIMIT_PER_MIN` |
