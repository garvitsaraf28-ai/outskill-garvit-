#!/usr/bin/env bash
# Outskill AI Mentor — one-command local setup.
#   curl -fsSL https://raw.githubusercontent.com/garvitsaraf28-ai/outskill-garvit-/claude/outskill-qa-agent-design-3r6w6j/qa-agent/run-local.sh | bash
# Re-running is safe: it updates the code and reuses your saved key.
set -euo pipefail

BRANCH="claude/outskill-qa-agent-design-3r6w6j"
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

# 2. Get / update the code — plain HTTPS download, no git / Xcode tools needed.
TARBALL_URL="${MENTOR_TARBALL:-https://codeload.github.com/garvitsaraf28-ai/outskill-garvit-/tar.gz/refs/heads/$BRANCH}"
echo "✓ Downloading code to $DIR"
TMP="$(mktemp -d)"
curl -fsSL "$TARBALL_URL" -o "$TMP/src.tgz"
tar -xzf "$TMP/src.tgz" -C "$TMP"
SRC_DIR="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
mkdir -p "$DIR/qa-agent"
cp -R "$SRC_DIR/qa-agent/." "$DIR/qa-agent/"   # .env and node_modules in $DIR are preserved
rm -rf "$TMP"
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
