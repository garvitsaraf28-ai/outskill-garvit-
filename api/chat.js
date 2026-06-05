// Live call turns → Claude claude-sonnet-4-6 via Anthropic API (fast, 1-2s)
// Scorecard JSON  → OpenRouter free models (not time-critical)

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY;
const CONVO_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 2600);

function parseModels(v) {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// Scorecard evaluator chain — free models are fine here (not real-time)
const SCORE_MODELS = parseModels(
  process.env.OPENROUTER_MODELS ||
    [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "z-ai/glm-4.5-air:free",
    ].join(",")
);

function cleanReply(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim()
    .replace(/^"|"$/g, "");
}

// ── Live call: Claude claude-sonnet-4-6 direct ─────────────────────────────────
async function callClaude({ system, messages }) {
  const body = {
    model: CONVO_MODEL,
    max_tokens: 350,
    temperature: 0.85,
    system: system || undefined,
    messages: messages.map(({ role, content }) => ({ role, content })),
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data?.error?.message) || `Anthropic error ${r.status}`);
  const reply = cleanReply(data?.content?.filter(b => b.type === "text").map(b => b.text).join(""));
  if (!reply) throw new Error("Empty reply from Claude");
  return { reply, model: CONVO_MODEL };
}

// ── Scorecard: OpenRouter free chain ──────────────────────────────────────────
async function callOpenRouterScore({ system, messages }) {
  const orMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
  let lastErr = "All scoring models busy. Try ending the call again in a moment.";
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1500));
    for (const model of SCORE_MODELS) {
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
            max_tokens: MAX_TOKENS,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: orMessages,
          }),
        });
        const data = await r.json();
        if (!r.ok) { lastErr = data?.error?.message || `Model error ${r.status}`; continue; }
        const reply = cleanReply(data?.choices?.[0]?.message?.content);
        if (!reply) { lastErr = `Empty reply from ${model}`; continue; }
        return { reply, model };
      } catch (e) { lastErr = String(e?.message || e); }
    }
  }
  const err = new Error(lastErr); err.allBusy = true; throw err;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, messages, json } = req.body || {};
  if (!Array.isArray(messages))
    return res.status(400).json({ error: "bad_request", message: "A 'messages' array is required." });

  try {
    if (json) {
      // Scorecard path — use OpenRouter free models
      if (!OR_KEY) return res.status(500).json({ error: "no_api_key", message: "No OPENROUTER_API_KEY set." });
      const { reply, model } = await callOpenRouterScore({ system, messages });
      return res.json({ content: [{ type: "text", text: reply }], model });
    } else {
      // Live call path — use Claude directly
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: "no_api_key", message: "No ANTHROPIC_API_KEY set in Vercel environment variables." });
      const { reply, model } = await callClaude({ system, messages });
      return res.json({ content: [{ type: "text", text: reply }], model });
    }
  } catch (e) {
    res.status(e.allBusy ? 503 : 502).json({ error: "model_error", message: String(e.message || e) });
  }
}
