#!/usr/bin/env bash
# Outskill AI Mentor — one-command local setup.
#   curl -fsSL https://raw.githubusercontent.com/garvitsaraf28-ai/outskill-garvit-/claude/outskill-qa-agent-design-3r6w6j/qa-agent/run-local.sh | bash
# Re-running is safe: it updates the code and reuses your saved key.
set -euo pipefail

BRANCH="claude/outskill-qa-agent-design-3r6w6j"
REPO_URL="${MENTOR_REPO:-https://github.com/garvitsaraf28-ai/outskill-garvit-.git}"
DIR="${MENTOR_DIR:-$HOME/outskill-ai-mentor}"

echo ""
echo "🎓 Outskill AI Mentor — local setup"
echo "-----------------------------------"

# 1. Node.js 20+
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Get it from https://nodejs.org (LTS), then run this command again."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js v$NODE_MAJOR is too old (need v20+). Update at https://nodejs.org, then re-run."
  exit 1
fi
echo "✓ Node.js $(node -v)"

# 2. Get / update the code
if [ -d "$DIR/.git" ]; then
  echo "✓ Updating existing copy in $DIR"
  git -C "$DIR" fetch origin "$BRANCH" --quiet
  git -C "$DIR" checkout "$BRANCH" --quiet
  git -C "$DIR" pull --ff-only origin "$BRANCH" --quiet
else
  echo "✓ Downloading code to $DIR"
  git clone --quiet --branch "$BRANCH" --single-branch "$REPO_URL" "$DIR"
fi
cd "$DIR/qa-agent"

# 3. Install dependencies
echo "✓ Installing dependencies…"
npm install --no-audit --no-fund --loglevel=error

# 4. API key (asked once, stored only in the local .env)
if [ ! -f .env ] || ! grep -Eq '^ANTHROPIC_API_KEY=..+' .env; then
  echo ""
  echo "One thing only you can provide: your Anthropic API key."
  echo "Get it at https://console.anthropic.com → API Keys → Create Key (starts with sk-ant-)."
  echo "It is saved ONLY to $DIR/qa-agent/.env on this machine."
  printf "Paste your key and press Enter: "
  IFS= read -r KEY < /dev/tty
  if [ -z "$KEY" ]; then
    echo "❌ No key entered. Re-run this command when you have one."
    exit 1
  fi
  printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > .env
  echo "✓ Key saved."
else
  echo "✓ Using the API key already saved in .env"
fi

# 5. Open the browser once the server is up, then start
(
  sleep 2.5
  if command -v open >/dev/null 2>&1; then open "http://localhost:8787"; \
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:8787"; fi
) >/dev/null 2>&1 &

echo ""
echo "✅ All set. Starting the Outskill AI Mentor at http://localhost:8787"
echo "   (Leave this window open. Press Ctrl+C to stop. Re-run the same command any time.)"
echo ""
npm start
