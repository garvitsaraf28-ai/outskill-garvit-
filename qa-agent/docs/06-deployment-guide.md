# Deployment Guide

## Shape of the deployment

A single stateless-ish Node process (state = `data/` directory) serving both the API and the
static UI. Any host that runs Node 20+ with a persistent disk works: a small VM, Railway,
Render, Fly.io. (Vercel-style serverless is **not** a fit for v1: SSE streams + file-backed
sessions want a long-lived process.)

## Minimal production checklist

1. **Process manager** — systemd unit or `pm2` with restart-on-crash.
   ```ini
   # /etc/systemd/system/outskill-mentor.service
   [Service]
   WorkingDirectory=/opt/outskill/qa-agent
   ExecStart=/usr/bin/node server/index.js
   Environment=NODE_ENV=production
   EnvironmentFile=/opt/outskill/qa-agent/.env
   Restart=always
   ```
2. **TLS + reverse proxy** (nginx/Caddy). For SSE through nginx set:
   `proxy_buffering off; proxy_read_timeout 3600s;`
3. **Secrets** — `ANTHROPIC_API_KEY` via env/secret store, never committed.
4. **Persistence** — back up `data/` (sessions + feedback) daily; the index is rebuildable.
5. **Logs** — capture stdout/stderr; the app logs profiler degradations, chat failures, and
   per-answer token usage is available in the `done` SSE event if you want to log it.
6. **Health** — poll `/api/health` (also validates the index loaded).

## Sizing for a weekend event

Assumptions: 5,000 concurrent attendees, 10% active, ~1 message per active user per 2 min
→ **~4 msg/s sustained, ~20 msg/s burst**. Each message ≈ 2 Claude calls (profiler at ~1k
in/0.2k out; answer at ~2k uncached-in + ~3.5k cached-in / ~0.3k out).

- **Node process:** trivially handles this (I/O-bound). One 2-vCPU box is ample.
- **Anthropic rate limits:** the binding constraint. At 20 msg/s burst you need roughly
  40 req/min × 60 = 2,400 RPM and ~(2.5k × 20 × 60) ≈ 3M input TPM (mostly cache reads) on
  the answer model. Check your tier at console.anthropic.com and request an increase before
  the first big event; the app surfaces 429s to users as a friendly retry message.
- **Cost envelope** (Opus 4.8 list prices, cache-read-dominated): roughly $0.02–0.05 per
  answered message; a 10k-message weekend ≈ $200–500. Lever: set `PROFILE_MODEL` /
  `SUMMARY_MODEL` to a smaller model after validating quality (see configuration guide).

## Zoom integration

Drop the URL in the Zoom session description / a pinned banner, or embed via `<iframe>` on
the event page. Session identity is a browser-local random ID — no login, zero PII required,
which is exactly right for a mid-session tool.

## Scaling beyond one box

1. Implement the session/feedback store interfaces against Postgres or Redis (they're
   deliberately narrow — `load/ensure/put/appendMessage/setFeedback`, `append`).
2. Run N processes behind a load balancer (no sticky sessions needed once the store is
   shared; the in-memory rate limiter should move to Redis at the same time).
3. Retrieval stays in-process (the index is a few hundred KB, loaded at boot on every node).

## Rollback

Deploys are plain files + npm install; keep the previous release directory and flip a
symlink. Knowledge-base changes are instant-rollback via git revert + `npm run ingest`.
