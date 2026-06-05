const API_KEY = process.env.OPENROUTER_API_KEY;
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 2600);
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 180); // shorter = faster real-time call feel

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

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

const CONVO_MODELS = parseModels(
  process.env.OPENROUTER_CONVO_MODELS ||
    [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "moonshotai/kimi-k2.6:free",
      "nvidia/nemotron-nano-9b-v2:free",
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

  let lastErr = "All free models are busy right now. Wait a few seconds and try again.";
  const chain = json ? MODELS : CONVO_MODELS;

  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1200));
    for (const model of chain) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${API_KEY}`,
            "content-type": "application/json",
            "x-title": "Hopkins Agent",
          },
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
  if (!API_KEY) {
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
