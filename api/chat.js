// All requests go through OpenRouter. Live call turns use a fast paid model
// if available (configurable), with free models as fallback. Scorecard JSON
// uses the free chain. The API key lives in Vercel env (OPENROUTER_API_KEY) —
// never hardcode it here.

const OR_KEY = process.env.OPENROUTER_API_KEY;
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 2600);
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 320);

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// Scorecard evaluator chain — paid fast model first for reliability, free fallbacks.
const SCORE_MODELS = parseModels(
  process.env.OPENROUTER_MODELS ||
    [
      "google/gemini-2.0-flash-001",              // fast + cheap (paid), best JSON compliance
      "anthropic/claude-3.5-haiku",               // strong JSON, paid fallback
      "meta-llama/llama-3.3-70b-instruct:free",   // free fallback
      "qwen/qwen3-next-80b-a3b-instruct:free",    // free fallback
    ].join(",")
);

// Live-call chain. Put fast/paid models FIRST for instant replies; free models
// remain as a safety net. Override with OPENROUTER_CONVO_MODELS in Vercel.
const CONVO_MODELS = parseModels(
  process.env.OPENROUTER_CONVO_MODELS ||
    [
      "google/gemini-2.0-flash-001",          // fast + cheap (paid)
      "anthropic/claude-3.5-haiku",           // fast + cheap (paid)
      "meta-llama/llama-3.3-70b-instruct:free", // free fallback
      "qwen/qwen3-next-80b-a3b-instruct:free",  // free fallback
    ].join(",")
);

function cleanReply(text) {
  let t = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t;
}

async function callOpenRouter({ system, messages, json }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  let lastErr = "All models are busy right now. Wait a few seconds and try again.";
  const chain = json ? SCORE_MODELS : CONVO_MODELS;
  const passes = json ? 2 : 1; // live call: single fast pass, don't stack latency

  for (let pass = 0; pass < passes; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1200));
    for (const model of chain) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${OR_KEY}`,
            "content-type": "application/json",
            "x-title": "Saraf.AI",
          },
          body: JSON.stringify({
            model,
            max_tokens: json ? MAX_TOKENS : CONVO_TOKENS,
            temperature: json ? 0.3 : 0.85,
            ...(json ? { response_format: { type: "json_object" } } : {}),
            messages: orMessages,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          lastErr = (data && data.error && data.error.message) || `Model error ${r.status}`;
          continue;
        }
        const reply = cleanReply(data?.choices?.[0]?.message?.content);
        if (!reply) { lastErr = `Empty reply from ${model}`; continue; }
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!OR_KEY) {
    return res.status(500).json({ error: "no_api_key", message: "No OPENROUTER_API_KEY set in Vercel environment variables." });
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
}
