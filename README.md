# OutSkill Training — New-Joiner Sales Onboarding

A guided, AI-powered onboarding platform that takes a new OutSkill sales joiner
from **day one to deal-closer** — company knowledge, the product & offer, live
voice mock-calls with instant coaching, and the ramp to real work. Built for
OutSkill by **Garvit Saraf**.

Live: https://outskill-garvit.vercel.app

## The journey (Cover → Login → Dashboard → 11 levels)

- **Cover** — branded splash → **Sign up / Log in** (proper account validation;
  signups/logins logged to a private Google Sheet via a token-guarded proxy).
- **Welcome Dashboard** — a clean roadmap + a click-to-open **analytics report**:
  completion %, program-knowledge %, mock-call average, rank/readiness, a
  completion donut, a selling-skills radar, a score trend, an AI coaching note,
  a "Today's focus" next-best-action, and achievement badges.
- **11 self-paced levels** (unlock sequentially):
  1. Company Foundations (+ funnel quiz)
  2. Mastermind Immersion (Generalist + Engineering recordings embedded in-portal)
  3. Department Overview
  4. Product & Offer (real price + payment routes + quiz)
  5. Sales Process (the 8-step call flow + knowledge check)
  6. **Mock-Call Room** — live voice mock-calls vs 9 real buyer personas, across
     4 hint-modes × 6 difficulty rounds (Peer → Director)
  7. Feedback (scorecard history + trends)
  8. Certification / Readiness
  9. Shadowing & Live Support
  10. Live Work Mode (record & report real calls, reports, follow-ups)
  11. Improvement Loop
- **Manager / Team view** — a passcode-gated leaderboard of every rep's
  completion, readiness, mock-call average and the team's weakest skill.

## The mock-call agent

Grounded in OutSkill's real data (anonymized — no learner PII): 9 buyer personas
with real objections and hidden motivations, the exact prices and payment routes
(Razorpay / Pine Labs / Shopse / Fibe-Propel / XP; zero-cost India EMI, +9%
international), the real 14-day curriculum, and the mastermind pitch patterns. A
senior coach AI scores each call on a weighted rubric with compliance auto-flags.

## Architecture

- **`src/App.jsx`** — the mock-call engine (personas, prompts, voice, scorecard)
  and the app shell.
- **`src/journey.jsx`** — the onboarding spine: cover, auth, dashboard analytics,
  level pages, quizzes, recordings, and the manager view.
- **`api/`** — Vercel serverless functions: `chat` (LLM proxy), `log`
  (signup/login → Google Sheet), `progress` (team leaderboard), `save-call`
  /`practice-calls` (mock-call team store), plus real-call transcription.

## Run locally

```bash
npm install
cp .env.example .env   # add OPENROUTER_API_KEY
npm run dev            # http://localhost:5173
```

## Optional integrations (Vercel env)

- `OPENROUTER_API_KEY` — required for the AI calls/scorecards.
- `SHEET_WEBHOOK` + `SHEET_TOKEN` — stream signups/logins to a private Google
  Sheet (Apps Script Web App).
- **Upstash Redis** (Storage → Marketplace, 1 click) — enables the cross-device
  **team store**; the Manager view and shared mock-call data light up
  automatically. Without it, the app still works off each browser's localStorage.
- `MANAGER_KEY` — a passcode that gates the Manager view's data.
