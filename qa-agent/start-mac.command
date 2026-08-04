#!/bin/bash
# Outskill AI Mentor — double-click to run (macOS).
# If macOS blocks it: right-click this file → Open → Open.
cd "$(dirname "$0")"
echo ""
echo "🎓 Outskill AI Mentor"
echo "---------------------"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required (free). Install the LTS from https://nodejs.org,"
  echo "   then double-click this file again."
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi
echo "✓ Node.js $(node -v)"

echo "✓ Installing dependencies (first run takes ~1 minute)…"
npm install --no-audit --no-fund --loglevel=error

if [ ! -f .env ] || ! grep -Eq '^(ANTHROPIC_API_KEY|OPENROUTER_API_KEY)=..+' .env; then
  echo ""
  echo "One-time setup: paste an API key. Two options:"
  echo "  FREE : OpenRouter key (sk-or-…) from https://openrouter.ai/keys — no card needed"
  echo "  PAID : Claude key (sk-ant-…) from https://console.anthropic.com — best quality"
  printf "Key: "
  IFS= read -r KEY
  if [ -z "$KEY" ]; then
    echo "❌ No key entered — run this file again when you have one."
    read -n 1 -s -r -p "Press any key to close…"
    exit 1
  fi
  case "$KEY" in
    sk-or-*) printf 'OPENROUTER_API_KEY=%s\n' "$KEY" > .env; echo "✓ Saved — running in FREE mode (OpenRouter)" ;;
    *)       printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > .env; echo "✓ Saved — running on Claude" ;;
  esac
fi

( sleep 2.5; open "http://localhost:8787" ) >/dev/null 2>&1 &
echo ""
echo "✅ Starting — your browser will open at http://localhost:8787"
echo "   Keep this window open while using the mentor. Close it (or Ctrl+C) to stop."
echo ""
npm start
