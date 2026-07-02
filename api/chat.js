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

// SPOKEN replies must sound like a human on the phone. Some fallback models
// leak chain-of-thought, markdown, code fences or stage directions into the
// visible reply — all of it gets read aloud by TTS. Strip every code-shaped
// artifact here, server-side, so no client ever hears it.
function sanitizeSpoken(text) {
  let t = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, " ");
  // An UNCLOSED think tag means everything after it is reasoning — drop it.
  const open = t.search(/<think>|<reasoning>/i);
  if (open !== -1) t = t.slice(0, open);
  t = t
    .replace(/```[\s\S]*?```/g, " ")            // fenced code blocks
    .replace(/`([^`\n]*)`/g, "$1")               // inline code → keep the words
    .replace(/\[[^\]\n]{0,80}\]/g, " ")          // [stage directions] / [labels]
    .replace(/\*\*([^*\n]{0,80})\*\*/g, "$1")    // **bold** → keep the words
    .replace(/\*([^*\n]{1,60})\*/g, "$1")        // *emphasis/emotes* → keep the words
    .replace(/^#{1,6}\s+/gm, "")                 // markdown headers
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")   // bullet / numbered list markers
    .replace(/^\s*(?:[A-Z][a-z]+(?: [A-Z][a-z]+)?|REP|LEARNER|PROSPECT|ASSISTANT|AI)\s*:\s*/, "") // speaker labels
    .replace(/[*_~#>|]+/g, " ")                  // leftover markdown decoration
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "") // emoji
    .replace(/\s+/g, " ")
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
    const raw = data?.choices?.[0]?.message?.content;
    const reply = json ? cleanReply(raw) : sanitizeSpoken(raw);
    if (!reply) throw new Error(`Empty reply from ${target}`);
    return reply;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error(`Timeout after ${timeoutMs}ms on ${target}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Model-health memory. Serverless functions stay warm between turns of the
// same call, so remembering which target just worked (and which just failed)
// makes every turn after the first go straight to a known-good model instead
// of re-paying for the same dead providers.
const modelDownUntil = new Map(); // target -> epoch-ms to skip until
let lastGoodModel = null;
const BILLING_COOLDOWN_MS = 10 * 60 * 1000; // credits/quota issues don't fix themselves fast
const FAIL_COOLDOWN_MS = 60 * 1000;         // rate-limit / hiccup — retry soon

function markFailed(target, msg) {
  const billing = /credit|quota|billing|payment|insufficient|402/i.test(msg || "");
  modelDownUntil.set(target, Date.now() + (billing ? BILLING_COOLDOWN_MS : FAIL_COOLDOWN_MS));
  if (lastGoodModel === target) lastGoodModel = null;
}

function orderChain(chain) {
  const now = Date.now();
  const healthy = chain.filter((t) => (modelDownUntil.get(t) || 0) <= now);
  const usable = healthy.length ? healthy : chain; // never end up with an empty chain
  if (lastGoodModel && usable.includes(lastGoodModel)) {
    return [lastGoodModel, ...usable.filter((t) => t !== lastGoodModel)];
  }
  return usable;
}

function perTryTimeout(target, json, timeoutMs) {
  // Paid targets answer in ~1-2s; if one hangs, bail early and move on —
  // only the free reasoning fallbacks get the full window.
  return target.includes(":free") ? timeoutMs : Math.min(timeoutMs, json ? 30000 : 12000);
}

// Hedged dispatch for LIVE-CALL turns: fire the best target immediately and,
// if it hasn't answered within `staggerMs`, fire the next one in parallel —
// first good reply wins, stragglers are ignored. A failure launches the next
// target at once. Convo replies are tiny (≤320 tokens), so the occasional
// duplicated request costs pennies and buys a hard latency bound.
function hedged(targets, orMessages, opts, staggerMs) {
  return new Promise((resolve, reject) => {
    let settled = false, pending = 0, nextIdx = 0;
    const errors = [];
    const maybeReject = () => {
      if (!settled && pending === 0 && nextIdx >= targets.length) {
        settled = true;
        reject(new Error(errors[errors.length - 1] || "All models are busy right now."));
      }
    };
    const launchNext = () => {
      if (settled || nextIdx >= targets.length) return;
      const target = targets[nextIdx++];
      pending++;
      tryModel(target, orMessages, { ...opts, timeoutMs: perTryTimeout(target, opts.json, opts.timeoutMs) })
        .then((reply) => {
          pending--;
          if (settled) return;
          settled = true;
          lastGoodModel = target;
          modelDownUntil.delete(target);
          resolve({ reply, model: target });
        })
        .catch((e) => {
          pending--;
          const msg = String((e && e.message) || e);
          errors.push(msg);
          markFailed(target, msg);
          if (!settled) launchNext();
          maybeReject();
        });
      if (nextIdx < targets.length) setTimeout(launchNext, staggerMs);
    };
    launchNext();
  });
}

async function callChain({ system, messages, json }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
  let lastErr = "All models are busy right now. Wait a few seconds and try again.";
  const baseChain = json ? SCORE_MODELS : CONVO_MODELS;
  const timeoutMs = json ? SCORE_TIMEOUT_MS : CONVO_TIMEOUT_MS;
  const maxTokens = json ? MAX_TOKENS : CONVO_TOKENS;

  if (!json) {
    // Live-call turn: hedged, first pass on healthy targets, second on the
    // full chain (ignores cooldowns, so a marked-down model can recover).
    try { return await hedged(orderChain(baseChain), orMessages, { json, maxTokens, timeoutMs }, 2000); }
    catch (e) { lastErr = String((e && e.message) || e); }
    await new Promise((r) => setTimeout(r, 600));
    try { return await hedged(baseChain, orMessages, { json, maxTokens, timeoutMs }, 1200); }
    catch (e) { lastErr = String((e && e.message) || e); }
  } else {
    // Scorecard: big token budget — sequential to avoid double-spending.
    for (let pass = 0; pass < 2; pass++) {
      if (pass > 0) await new Promise((r) => setTimeout(r, 800));
      const chain = pass === 0 ? orderChain(baseChain) : baseChain;
      for (const target of chain) {
        try {
          const reply = await tryModel(target, orMessages, { json, maxTokens, timeoutMs: perTryTimeout(target, json, timeoutMs) });
          lastGoodModel = target;
          modelDownUntil.delete(target);
          return { reply, model: target };
        } catch (e) {
          lastErr = String((e && e.message) || e);
          markFailed(target, lastErr);
        }
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
