# Saraf.AI — Sales Mock-Call Trainer

A local web app where a sales rep runs a voice mock-call against a realistic AI
prospect and gets an instant, scored coaching breakdown. Adapted from the
single-file Claude artifact into a standalone app you can run on your machine.

## How it works

- **`src/`** — the React frontend (the trainer UI, personas, voice, scorecard).
- **`server.js`** — a small backend that holds your OpenRouter API key and
  forwards chat requests to a chain of **free** models (falling through on
  rate-limits). The key stays server-side, never in the browser.

## Run it locally

```bash
npm install

# 1. Add your key
cp .env.example .env
#    then edit .env and paste your OPENROUTER_API_KEY (https://openrouter.ai/keys)

# 2. Start (runs the frontend and backend together)
npm run dev
```

Open **http://localhost:5173**.

Voice input works best in Chrome or Edge and needs microphone permission. If the
mic is blocked, the prospect still speaks aloud and you type your replies.

> Without a key in `.env`, the UI loads but conversations will fail with a clear
> message. Add the key and restart to talk to the prospect.
>
> Uses **free** OpenRouter models only. These are rate-limited and shared, so a
> turn occasionally takes a few seconds while the backend falls through to an
> available model. Set `OPENROUTER_MODELS` in `.env` to change the chain.

## Production build (later)

```bash
npm run build   # outputs to dist/
npm start       # serves the built app + backend on PORT (default 3001)
```
