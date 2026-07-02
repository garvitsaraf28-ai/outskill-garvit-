// The mock call's engine. All requests go through OpenRouter with a PAID-first
// chain (fast, reliable — the account is funded) and free models as a safety
// net. Each attempt has its own timeout so one slow provider can never stall a
// live call turn. The API key lives in Vercel env (OPENROUTER_API_KEY).
//
// GET  /api/chat          -> { ok, keyConfigured, chains }        (no network)
// GET  /api/chat?diag=1   -> pings EVERY model with your key, reports ok + latency
// POST /api/chat          -> { content:[{type:"text",text}], model }

const OR_KEY = process.env.OPENROUTER_API_KEY;
// Generous so the long JSON scorecard isn't truncated.
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 4000);
// Conversation replies are 1-3 spoken sentences — small cap = fast generation.
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 320);
// Per-attempt timeouts: a live turn must never hang on one slow provider.
// Wide enough for the free reasoning models (until credits make paid instant).
const CONVO_TIMEOUT_MS = Number(process.env.OPENROUTER_CONVO_TIMEOUT_MS || 25000);
const SCORE_TIMEOUT_MS = Number(process.env.OPENROUTER_SCORE_TIMEOUT_MS || 40000);

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// LIVE-CALL chain — paid + fast first (instant once the account has credits),
// then the free models that actually respond on this account today. Dead free
// slugs (kimi-k2.6:free, glm-4.5-air:free — no longer free) were removed after
// a live probe; they'd only add failed hops.
const CONVO_MODELS = parseModels(
  process.env.OPENROUTER_CONVO_MODELS ||
    [
      "google/gemini-2.5-flash",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ].join(",")
);

// GRADING chain — strong JSON compliance first, free reasoners as fallback.
const SCORE_MODELS = parseModels(
  process.env.OPENROUTER_MODELS ||
    [
      "google/gemini-2.5-flash",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
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

async function tryModel(model, orMessages, { json, maxTokens, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${OR_KEY}`,
        "content-type": "application/json",
        "x-title": "OutSkill Training",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: json ? 0.2 : 0.8,
        // Route to the lowest-latency provider when several serve this model.
        provider: { sort: "latency" },
        // Keeps reasoning models from burning the budget on hidden thinking;
        // non-reasoning models ignore it.
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
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error(`Timeout after ${timeoutMs}ms on ${model}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouter({ system, messages, json }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
  let lastErr = "All models are busy right now. Wait a few seconds and try again.";
  const chain = json ? SCORE_MODELS : CONVO_MODELS;
  const timeoutMs = json ? SCORE_TIMEOUT_MS : CONVO_TIMEOUT_MS;
  const maxTokens = json ? MAX_TOKENS : CONVO_TOKENS;

  // Two passes: with a funded key the first model succeeds almost always; the
  // second pass only exists for the rare moment the whole chain hiccups.
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 800));
    for (const model of chain) {
      try {
        const reply = await tryModel(model, orMessages, { json, maxTokens, timeoutMs });
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
  if (req.method === "GET") {
    if (!req.query.diag) {
      return res.json({ ok: true, keyConfigured: !!OR_KEY, convoChain: CONVO_MODELS, scoreChain: SCORE_MODELS });
    }
    if (!OR_KEY) return res.json({ ok: false, error: "no_api_key", message: "Set OPENROUTER_API_KEY in Vercel env vars, then redeploy." });
    // Probe EVERY model (both chains) in parallel with a small ping + latency.
    // 64 tokens (not 8): reasoning models spend a little budget thinking and
    // would otherwise false-negative with an empty visible reply.
    const models = [...new Set([...CONVO_MODELS, ...SCORE_MODELS])];
    const results = await Promise.all(models.map(async (model) => {
      const t0 = Date.now();
      try {
        await tryModel(model, [{ role: "user", content: "Say OK" }], { json: false, maxTokens: 64, timeoutMs: 20000 });
        return { model, ok: true, ms: Date.now() - t0 };
      } catch (e) {
        return { model, ok: false, ms: Date.now() - t0, error: String((e && e.message) || e).slice(0, 140) };
      }
    }));
    const working = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
    const creditsIssue = results.some((r) => !r.ok && /credit/i.test(r.error || ""));
    return res.json({
      ok: working.length > 0,
      creditsIssue,
      message: creditsIssue
        ? "⚠ Your OpenRouter account has NO usable credits — the fast paid models are all rejected. Add credits at openrouter.ai/settings/credits and replies become ~1s. Until then the app runs on slower free models."
        : working.length
        ? "Chain is healthy — the mock call uses the first working model in order."
        : "No model responded — check the key and credits at openrouter.ai/settings/credits.",
      fastest: working[0] || null,
      results,
    });
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
