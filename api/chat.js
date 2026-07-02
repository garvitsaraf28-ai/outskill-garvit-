// All requests go through OpenRouter. Mirrors the tuned chain from server.js:
// FREE models only (no paid IDs that can be deprecated or need credits), ordered
// for latency, with a second pass when the whole chain is momentarily
// rate-limited. The API key lives in Vercel env (OPENROUTER_API_KEY).
//
// GET  /api/chat          -> { ok, keyConfigured }           (no network)
// GET  /api/chat?diag=1   -> pings the chain, reports the first working model
// POST /api/chat          -> { content:[{type:"text",text}], model }

const OR_KEY = process.env.OPENROUTER_API_KEY;
// Generous so the long JSON scorecard isn't truncated on reasoning models.
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 4000);
// Conversation replies are 1-3 spoken sentences — a small cap generates fast.
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 320);

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// GRADING chain — heavy reasoners are fine here (forced-JSON keeps output clean).
const SCORE_MODELS = parseModels(
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

// CONVERSATION chain — leak-safe instruct models first, then the small fast
// nano. Big reasoning models are excluded: at a small token budget they can
// spill chain-of-thought into the spoken reply.
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

async function tryModel(model, orMessages, json, maxTokens) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OR_KEY}`,
      "content-type": "application/json",
      "x-title": "OutSkill Training",
    },
    // effort:"low" keeps reasoning models from burning the budget on hidden
    // thinking; non-reasoning models ignore it.
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      reasoning: { effort: "low" },
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: orMessages,
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && data.error && data.error.message) || `Model error ${r.status}`);
  }
  const reply = cleanReply(data?.choices?.[0]?.message?.content);
  if (!reply) throw new Error(`Empty reply from ${model}`);
  return reply;
}

async function callOpenRouter({ system, messages, json }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
  let lastErr = "All free models are busy right now. Wait a few seconds and try again.";
  const chain = json ? SCORE_MODELS : CONVO_MODELS;

  // Two passes: if the whole chain is momentarily rate-limited, a short wait
  // usually clears it on the free tier (cheaper than failing the turn).
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1200));
    for (const model of chain) {
      try {
        const reply = await tryModel(model, orMessages, json, json ? MAX_TOKENS : CONVO_TOKENS);
        return { reply, model };
      } catch (e) {
        lastErr = String((e && e.message) || e);
      }
    }
  }
  const err = new Error(lastErr);
  err.allBusy = true;
  throw err;
}

export default async function handler(req, res) {
  // Self-test: quick health check for the live site.
  if (req.method === "GET") {
    if (!req.query.diag) {
      return res.json({ ok: true, keyConfigured: !!OR_KEY, convoChain: CONVO_MODELS, scoreChain: SCORE_MODELS });
    }
    if (!OR_KEY) return res.json({ ok: false, error: "no_api_key", message: "Set OPENROUTER_API_KEY in Vercel env vars, then redeploy." });
    const tried = [];
    for (const model of CONVO_MODELS) {
      try {
        const reply = await tryModel(model, [{ role: "user", content: "Say OK" }], false, 10);
        return res.json({ ok: true, workingModel: model, reply, tried });
      } catch (e) {
        tried.push({ model, error: String((e && e.message) || e).slice(0, 160) });
      }
    }
    return res.json({ ok: false, error: "all_failed", tried });
  }

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
