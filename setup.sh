#!/usr/bin/env bash
# One-shot setup for the OutSkill Sales Platform (Mac / Linux).
# Usage:  bash setup.sh
set -e

echo ""
echo "  OutSkill Sales Platform — setup"
echo "  --------------------------------"

# 1. Node check
if ! command -v node >/dev/null 2>&1; then
  echo "  ✗ Node.js is not installed. Install Node 18+ from https://nodejs.org and re-run."
  exit 1
fi
echo "  ✓ Node $(node --version)"

# 2. App dependencies
echo "  • Installing app dependencies (npm install)…"
npm install --no-fund --no-audit

# 3. .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✓ Created .env  — open it and paste your OPENROUTER_API_KEY"
else
  echo "  ✓ .env already exists"
fi

# 4. Whisper model (for the Real Call feature)
mkdir -p models
if [ ! -f models/ggml-small.en.bin ]; then
  echo "  • Downloading local transcription model (~465 MB, one time)…"
  curl -L --fail -o models/ggml-small.en.bin \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" \
    || echo "  ! Model download failed — the Real Call feature won't transcribe until it's present."
else
  echo "  ✓ Transcription model present"
fi

# 5. Audio tools for Real Call (Mac = Homebrew, Linux = apt hint)
if [[ "$OSTYPE" == darwin* ]]; then
  if command -v brew >/dev/null 2>&1; then
    command -v ffmpeg      >/dev/null 2>&1 || { echo "  • Installing ffmpeg…";      brew install ffmpeg; }
    command -v whisper-cli >/dev/null 2>&1 || { echo "  • Installing whisper-cpp…"; brew install whisper-cpp; }
    echo "  ✓ Audio tools ready (ffmpeg + whisper-cli)"
  else
    echo "  ! Homebrew not found — install it from https://brew.sh to enable the Real Call feature."
  fi
else
  command -v ffmpeg >/dev/null 2>&1 || echo "  ! For Real Call: install ffmpeg (e.g. 'sudo apt install ffmpeg') and whisper.cpp."
fi

echo ""
echo "  Done. Next:"
echo "   1) Put your OpenRouter key in the .env file"
echo "   2) Run:  npm run dev"
echo "   3) Open: http://localhost:5173"
echo ""
