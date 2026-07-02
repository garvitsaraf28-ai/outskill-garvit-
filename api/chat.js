// The mock call's engine. Requests go to the fastest funded provider:
//   1. OpenAI DIRECT (api.openai.com) when OPENAI_API_KEY is set — for accounts
//      recharged at platform.openai.com.
//   2. OpenRouter (openrouter.ai) paid-first chain when OPENROUTER_API_KEY is
//      set — for accounts recharged at openrouter.ai.
//   3. OpenRouter free models as the always-on safety net.
// Each attempt has its own timeout so one slow provider can never stall a live
// call turn. Keys live in Vercel env — never in this repo.
//
// GET  /api/chat          -> { ok, keys, chains }                (no network)
// GET  /api/chat?diag=1   -> pings EVERY target, reports ok + latency
// POST /api/chat          -> { content:[{type:"text",text}], model }

const OR_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Generous so the long JSON scorecard isn't truncated.
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 4000);
// Conversation replies are 1-3 spoken sentences — small cap = fast generation.
const CONVO_TOKENS = Number(process.env.OPENROUTER_CONVO_TOKENS || 320);
// Per-attempt timeouts: wide enough for the free reasoning models; paid models
// answer in ~1-2s so these are only ever felt on the fallback tail.
const CONVO_TIMEOUT_MS = Number(process.env.OPENROUTER_CONVO_TIMEOUT_MS || 25000);
const SCORE_TIMEOUT_MS = Number(process.env.OPENROUTER_SCORE_TIMEOUT_MS || 40000);

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// OpenAI-direct models (used only when OPENAI_API_KEY is set). "openai:" prefix
// marks a target as api.openai.com rather than OpenRouter.
const OPENAI_MODELS = parseModels(process.env.OPENAI_MODELS || "gpt-4o-mini,gpt-4.1-mini")
  .map((m) => (m.startsWith("openai:") ? m : `openai:${m}`));

// OpenRouter LIVE-CALL chain — paid + fast first, then the free models that
// actually respond (dead free slugs removed after a live probe).
const OR_CONVO = parseModels(
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

// OpenRouter GRADING chain — strong JSON compliance first, free reasoners last.
const OR_SCORE = parseModels(
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

// Effective chains: OpenAI-direct first (when funded), then OpenRouter.
const CONVO_MODELS = [...(OPENAI_KEY ? OPENAI_MODELS : []), ...(OR_KEY ? OR_CONVO : [])];
const SCORE_MODELS = [...(OPENAI_KEY ? OPENAI_MODELS : []), ...(OR_KEY ? OR_SCORE : [])];

function cleanReply(text) {
  let t = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t;
}

async function tryModel(target, orMessages, { json, maxTokens, timeoutMs }) {
  const isOpenAI = target.startsWith("openai:");
  const model = isOpenAI ? target.slice(7) : target;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = {
      model,
      max_tokens: maxTokens,
      temperature: json ? 0.2 : 0.8,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: orMessages,
    };
    if (!isOpenAI) {
      // OpenRouter-only knobs (OpenAI rejects unknown params).
      body.provider = { sort: "latency" };   // lowest-latency provider
      body.reasoning = { effort: "low" };    // stop hidden-thinking burn
    }
    const r = await fetch(
      isOpenAI ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${isOpenAI ? OPENAI_KEY : OR_KEY}`,
          "content-type": "application/json",
          ...(isOpenAI ? {} : { "x-title": "OutSkill Training" }),
        },
        body: JSON.stringify(body),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      throw new Error((data && data.error && data.error.message) || `Model error ${r.status}`);
    }
    const reply = cleanReply(data?.choices?.[0]?.message?.content);
    if (!reply) throw new Error(`Empty reply from ${target}`);
    return reply;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error(`Timeout after ${timeoutMs}ms on ${target}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callChain({ system, messages, json }) {
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
    for (const target of chain) {
      try {
        const reply = await tryModel(target, orMessages, { json, maxTokens, timeoutMs });
        return { reply, model: target };
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
      return res.json({
        ok: true,
        openaiKeyConfigured: !!OPENAI_KEY,
        openrouterKeyConfigured: !!OR_KEY,
        convoChain: CONVO_MODELS,
        scoreChain: SCORE_MODELS,
      });
    }
    if (!OPENAI_KEY && !OR_KEY) {
      return res.json({ ok: false, error: "no_api_key", message: "Set OPENAI_API_KEY and/or OPENROUTER_API_KEY in Vercel env vars, then redeploy." });
    }
    // Probe EVERY target (both chains) in parallel with a small ping + latency.
    // 64 tokens (not 8): reasoning models spend a little budget thinking and
    // would otherwise false-negative with an empty visible reply.
    const targets = [...new Set([...CONVO_MODELS, ...SCORE_MODELS])];
    const results = await Promise.all(targets.map(async (target) => {
      const t0 = Date.now();
      try {
        await tryModel(target, [{ role: "user", content: "Say OK" }], { json: false, maxTokens: 64, timeoutMs: 20000 });
        return { model: target, ok: true, ms: Date.now() - t0 };
      } catch (e) {
        return { model: target, ok: false, ms: Date.now() - t0, error: String((e && e.message) || e).slice(0, 140) };
      }
    }));
    const working = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
    const creditsIssue = results.some((r) => !r.ok && /credit|quota|billing/i.test(r.error || ""));
    return res.json({
      ok: working.length > 0,
      creditsIssue,
      message: working.length
        ? `Healthy — the mock call answers via ${working[0].model} (~${working[0].ms}ms).${creditsIssue ? " Note: some paid targets still report a credits/billing issue — see results." : ""}`
        : "No model responded — check the key(s) and billing (openrouter.ai/settings/credits or platform.openai.com/billing).",
      fastest: working[0] || null,
      results,
    });
  }

  if (req.method !== "POST") return res.status(405).end();
  if (!OPENAI_KEY && !OR_KEY) {
    return res.status(500).json({ error: "no_api_key", message: "No OPENAI_API_KEY or OPENROUTER_API_KEY set in Vercel environment variables." });
  }
  const { system, messages, json } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "bad_request", message: "A 'messages' array is required." });
  }
  try {
    const { reply, model } = await callChain({ system, messages, json });
    res.json({ content: [{ type: "text", text: reply }], model });
  } catch (e) {
    res.status(e.allBusy ? 503 : 502).json({ error: "model_error", message: String(e.message || e) });
  }
}
