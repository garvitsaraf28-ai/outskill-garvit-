OUTSKILL AI MENTOR — how to run this on your computer
======================================================

You received the complete project. It runs on YOUR computer; nothing else is
needed from the person who sent it.

WHAT YOU NEED
  1. Node.js (free) — download the LTS version from https://nodejs.org and install it.
  2. ONE API key — two options:
     FREE : OpenRouter — sign up at https://openrouter.ai (no card needed),
            open "Keys", create a key (starts with sk-or-). Free models,
            roughly 50 questions/day, good for testing and demos.
     PAID : Claude (best quality — recommended for real events) — sign in at
            https://console.anthropic.com, open "API Keys", create a key
            (starts with sk-ant-), and add credits under Settings -> Billing
            ($5 minimum covers hundreds of questions).
     The start script auto-detects which kind of key you paste.

HOW TO START
  On Mac:      double-click  start-mac.command
               (if macOS blocks it: right-click the file -> Open -> Open)
  On Windows:  double-click  start-windows.bat

  The first run installs everything (about a minute), asks you to paste the
  API key ONCE, then opens the chat in your browser at http://localhost:8787.

  Keep the black window open while you use it. Close it to stop.
  Next time: just double-click the same file again — no setup, it remembers.

WHAT THIS PROJECT IS
  An AI mentor for Outskill's live events (Masterminds / Bootcamps). When Zoom
  chat is off, participants ask it anything — AI concepts, careers, program
  details, pricing — and it answers instantly, personalized to who's asking,
  grounded in the official program facts in the knowledge/ folder.

WHERE TO LOOK
  README.md   — full project overview
  docs/       — architecture, research, setup, deployment, maintenance guides
  knowledge/  — the program facts the AI answers from (editable)

TROUBLESHOOTING
  "Node.js is required"  -> install it from https://nodejs.org, run again.
  Answers say "I hit a snag" -> the API key is missing/invalid. Delete the
  .env file in this folder and double-click the start file to re-enter it.
