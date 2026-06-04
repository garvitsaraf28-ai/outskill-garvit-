# OutSkill Sales Platform — Setup Guide

A local web app for the OutSkill sales team: practice mock calls with AI, record
real learner calls and get CRM reports, plus a reports dashboard and follow-ups.

Runs entirely on your own laptop. Follow the steps below.

---

## 1. Install Node.js (required)

Download and install **Node.js 18 or newer** from <https://nodejs.org> (the "LTS"
version is fine). To check it worked, open a terminal and run:

```bash
node --version
```

You should see something like `v20.x` or `v22.x`.

---

## 2. Get a free OpenRouter API key (required)

The AI runs through OpenRouter's **free** models.

1. Go to <https://openrouter.ai> and sign up (free).
2. Open <https://openrouter.ai/keys> and create a key (starts with `sk-or-v1-...`).
3. Keep it handy for step 4.

> The person who sent you this project may instead give you a key to use. Either works.

---

## 3. Install everything

**Mac or Linux** — in a terminal, inside this project folder, run:

```bash
bash setup.sh
```

This installs the app's dependencies, downloads the local transcription model,
and (on Mac) installs the audio tools needed for the "Real Call" feature.

**Windows** — run these instead:

```powershell
npm install
copy .env.example .env
```

(The "Real Call" recording-to-report feature also needs `ffmpeg` and
`whisper.cpp` — see the note at the bottom. Everything else works without them.)

---

## 4. Add your API key

Open the file named **`.env`** in this folder with any text editor and paste your
key so the line reads:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Save the file.

---

## 5. Run it

```bash
npm run dev
```

Then open **http://localhost:5173** in Chrome or Edge.

To stop it, press `Ctrl + C` in the terminal. To start it again later, just run
`npm run dev` again from this folder.

---

## What works without extra setup
- The **cover page**, **Practice mock calls** (with voice + coaching scorecard),
  the **Reports** and **Follow-ups** screens. You only need steps 1–5 above.

## The "Real Call" feature (optional extra tools)
Uploading a real call recording → transcript → report needs two free tools:
- **ffmpeg** and **whisper.cpp** installed, plus a Whisper model file.
- On **Mac**, `setup.sh` does all of this automatically (via Homebrew).
- On **Windows/Linux**, install `ffmpeg` and `whisper.cpp` yourself, then download
  the model into a `models/` folder:
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin`

If these aren't installed, the rest of the app still works fine — only the
real-call transcription step will show an error.

---

## Troubleshooting
- **"site can't be reached"** → the server isn't running. Run `npm run dev` and
  keep that terminal window open.
- **AI replies fail** → check your key is in `.env` and restart (`Ctrl+C`, then
  `npm run dev`). Free models are also rate-limited, so occasionally a reply lags
  or says "all busy — try again."
- **Voice/mic** → works best in Chrome/Edge; click "Allow" when asked for the mic.
