import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.OPENROUTER_API_KEY;
// Generous so the long JSON scorecard isn't truncated on reasoning models
// (truncated JSON = the coaching card can't be parsed and falls back to raw text).
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 4000);
// Conversation replies are 1-3 spoken sentences — a small cap makes them
// generate (and start speaking) much faster.
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 320);
const PORT = process.env.PORT || 3001;
const CALLS_DIR = path.join(__dirname, "calls");
const REAL_DIR = path.join(CALLS_DIR, "real");
// Local Whisper model for transcribing uploaded real-call recordings (private,
// free, on-device). Swap to a bigger ggml model via WHISPER_MODEL for accuracy.
const MODEL_PATH = path.join(__dirname, "models", process.env.WHISPER_MODEL || "ggml-small.en.bin");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });

// Free OpenRouter models only (no Anthropic / Gemini / GPT / Opus), tried in
// order. The popular instruct models are often rate-limited on the free tier,
// so the chain falls through to the NVIDIA Nemotron free models, which are
// reasoning models that correctly keep their thinking in a separate field.
// Override with OPENROUTER_MODELS in .env (comma-separated).
// Order tuned for LATENCY. llama-3.3-70b is best+fast when available and a
// rate-limit fails in ~1s, so it leads cheaply. Right behind is the small, FAST
// and reliably-available nemotron-nano (the real-time workhorse). Heavyweight
// models are last as a quality fallback only.
function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// GRADING chain — heavy reasoners are fine here (forced-JSON mode keeps output
// clean) and add quality as fallbacks.
const MODELS = parseModels(
  process.env.OPENROUTER_MODELS ||
    [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "z-ai/glm-4.5-air:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
    ].join(",")
);

// CONVERSATION chain — leak-safe only. Instruct models (no hidden reasoning to
// leak) first, then the small fast nano. The big reasoning models are
// deliberately EXCLUDED here: at a small token budget they sometimes spill
// their chain-of-thought into the spoken reply.
const CONVO_MODELS = parseModels(
  process.env.OPENROUTER_CONVO_MODELS ||
    [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "moonshotai/kimi-k2.6:free",
      "nvidia/nemotron-nano-9b-v2:free",
    ].join(",")
);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Strip any reasoning that leaked into the visible reply (belt-and-braces;
// most models keep it in a separate field, but some wrap it in <think> tags).
function cleanReply(text) {
  let t = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
  // Some small models wrap a whole spoken line in quotes — strip them so TTS
  // doesn't read them out.
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t;
}

async function callOpenRouter({ system, messages, json }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  let lastErr = "All free models are busy right now. Wait a few seconds and try again.";
  const chain = json ? MODELS : CONVO_MODELS;

  // Two passes: if the whole chain is momentarily rate-limited, a short wait
  // usually clears it on the free tier (cheaper than failing the turn).
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1200));
    for (const model of chain) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${API_KEY}`,
          "content-type": "application/json",
          "x-title": "Saraf.AI",
        },
        // effort:"low" keeps reasoning models from burning time/tokens on long
        // hidden reasoning; non-reasoning models ignore it. The scorecard call
        // (json) gets a big budget + forced-JSON; conversation turns get a small
        // budget so they generate fast.
        body: JSON.stringify({
          model,
          max_tokens: json ? MAX_TOKENS : CONVO_TOKENS,
          reasoning: { effort: "low" },
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: orMessages,
        }),
      });
      const data = await r.json();

      if (!r.ok) {
        // 429 = this free model is rate-limited upstream; 5xx = provider hiccup.
        // Either way, fall through to the next model in the chain.
        lastErr = (data && data.error && data.error.message) || `Model error ${r.status}`;
        continue;
      }

      const reply = cleanReply(data?.choices?.[0]?.message?.content);
      if (!reply) {
        lastErr = `Empty reply from ${model}`;
        continue; // try the next model
      }
      return { reply, model };
    } catch (e) {
      lastErr = String((e && e.message) || e);
      continue;
    }
    }
  }

  const err = new Error(lastErr);
  err.allBusy = true;
  throw err;
}

// The one endpoint the frontend calls. Holds the key server-side and returns
// an Anthropic-shaped payload so the frontend needs no changes.
app.post("/api/chat", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: "no_api_key",
      message: "No OPENROUTER_API_KEY found. Copy .env.example to .env, paste your key, and restart the server.",
    });
  }
  const { system, messages, json } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "bad_request", message: "A 'messages' array is required." });
  }
  try {
    const { reply, model } = await callOpenRouter({ system, messages, json });
    res.json({ content: [{ type: "text", text: reply }], model });
  } catch (e) {
    res.status(e.allBusy ? 503 : 502).json({ error: "model_error", message: String(e.message || e) });
  }
});

// Persist a finished call (full transcript + scorecard) to disk so every
// session is reviewable later. One JSON file per call in ./calls, plus a
// one-line summary appended to ./calls/index.jsonl for quick scanning.
app.post("/api/save-call", (req, res) => {
  try {
    const rec = req.body || {};
    if (!fs.existsSync(CALLS_DIR)) fs.mkdirSync(CALLS_DIR, { recursive: true });
    const ts = Number(rec.ts) || Date.now();
    const persona = String(rec.persona || "call").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    const base = `${ts}-${persona}`;
    fs.writeFileSync(path.join(CALLS_DIR, `${base}.json`), JSON.stringify(rec, null, 2));
    const summary = {
      ts,
      file: `${base}.json`,
      mode: rec.mode,
      persona: rec.persona,
      duration: rec.duration,
      overall: rec.overall ?? null,
      correctRouting: rec.correctRouting ?? null,
    };
    fs.appendFileSync(path.join(CALLS_DIR, "index.jsonl"), JSON.stringify(summary) + "\n");
    res.json({ ok: true, file: `${base}.json` });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
});

/* ---------------- Real calls: upload recording → transcribe → report ------- */

const slug = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "learner";

// 1) Upload an audio recording of a real call. We save the audio, convert it to
//    16k mono WAV with ffmpeg, and transcribe it locally with whisper.cpp.
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_audio", message: "No audio file uploaded." });
  if (!fs.existsSync(MODEL_PATH)) {
    return res.status(500).json({ error: "no_model", message: `Whisper model missing at ${MODEL_PATH}.` });
  }
  const ts = Number(req.body.ts) || Date.now();
  const id = `${ts}-${slug(req.body.learnerName)}`;
  const dir = path.join(REAL_DIR, id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ext = (path.extname(req.file.originalname) || ".audio").toLowerCase();
    const audioFile = `audio${ext}`;
    fs.writeFileSync(path.join(dir, audioFile), req.file.buffer);

    const wav = path.join(dir, "audio16k.wav");
    await execFileP("ffmpeg", ["-y", "-i", path.join(dir, audioFile), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);

    const outBase = path.join(dir, "transcript");
    await execFileP("whisper-cli", ["-m", MODEL_PATH, "-f", wav, "-otxt", "-of", outBase, "-nt"], { maxBuffer: 64 * 1024 * 1024 });
    const transcript = fs.readFileSync(`${outBase}.txt`, "utf8").replace(/\s+\n/g, "\n").trim();

    try { fs.unlinkSync(wav); } catch {} // keep original audio, drop the temp wav
    res.json({ id, audioFile, transcript });
  } catch (e) {
    res.status(500).json({ error: "transcribe_failed", message: String((e && e.message) || e) });
  }
});

// 2) Save the finished real-call record (metadata + transcript + the report the
//    frontend generated). One report.json per call dir.
app.post("/api/real-call", (req, res) => {
  try {
    const rec = req.body || {};
    const id = rec.id && /^[0-9]+-[a-z0-9-]+$/.test(rec.id) ? rec.id : `${Date.now()}-${slug(rec.learnerName)}`;
    const dir = path.join(REAL_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({ ...rec, id }, null, 2));
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
});

// 3) List every real-call report (for the Reports dashboard + Follow-ups).
app.get("/api/real-calls", (_req, res) => {
  try {
    if (!fs.existsSync(REAL_DIR)) return res.json({ calls: [] });
    const calls = fs.readdirSync(REAL_DIR)
      .map((id) => {
        const f = path.join(REAL_DIR, id, "report.json");
        if (!fs.existsSync(f)) return null;
        try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    res.json({ calls });
  } catch (e) {
    res.status(500).json({ calls: [], message: String((e && e.message) || e) });
  }
});

// 4) Stream the stored audio back for playback in the report view.
app.get("/api/real-calls/:id/audio", (req, res) => {
  const id = req.params.id;
  if (!/^[0-9]+-[a-z0-9-]+$/.test(id)) return res.status(400).end();
  const dir = path.join(REAL_DIR, id);
  try {
    const audio = fs.existsSync(dir) && fs.readdirSync(dir).find((f) => /^audio\.[a-z0-9]+$/i.test(f));
    if (!audio) return res.status(404).end();
    res.sendFile(path.join(dir, audio));
  } catch {
    res.status(404).end();
  }
});

// In production (after `npm run build`), serve the built frontend too.
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => {
  console.log(`Saraf.AI backend → http://localhost:${PORT}`);
  console.log(`  Conversation chain: ${CONVO_MODELS.join(" → ")}`);
  console.log(`  Grading chain:      ${MODELS.join(" → ")}`);
  if (!API_KEY) console.log("  ⚠  No OPENROUTER_API_KEY set — calls will fail until you add one to .env");
});
