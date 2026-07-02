// Free-mode provider: adapts OpenRouter's OpenAI-compatible API to the small
// slice of the Anthropic SDK surface this app uses (messages.create /
// messages.stream with .on("text") + .finalMessage()). Lets the app run at
// zero cost on ":free" models for demos and testing. Claude remains the
// default and recommended provider for real events (ADR-002) — free models
// are weaker at objection nuance and compliance discipline.

function systemText(system) {
  if (!system) return "";
  if (typeof system === "string") return system;
  return system.map((b) => b.text || "").join("\n\n");
}

export function toOpenAIRequest(params, model) {
  const messages = [];
  const wantJson = Boolean(params.output_config?.format?.schema);
  let sys = systemText(params.system);
  if (wantJson) {
    sys +=
      "\n\nRespond with ONLY a single valid JSON object (no prose, no code fences) matching this JSON schema:\n" +
      JSON.stringify(params.output_config.format.schema);
  }
  if (sys) messages.push({ role: "system", content: sys });
  for (const m of params.messages) {
    messages.push({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content.map((c) => c.text || "").join("\n"),
    });
  }
  return {
    model,
    messages,
    max_tokens: params.max_tokens,
    ...(wantJson ? { response_format: { type: "json_object" } } : {}),
  };
}

function stripJsonFences(text) {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (m ? m[1] : text).trim();
}

async function throwHttpError(res) {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    message = body?.error?.message || body?.error || message;
  } catch {}
  const err = new Error(String(message));
  err.status = res.status;
  throw err;
}

export function createOpenRouterClient(config) {
  const base = config.openrouterBaseUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.openrouterKey}`,
    "HTTP-Referer": "http://localhost",
    "X-Title": "Outskill AI Mentor",
  };

  async function post(body, { timeout, signalExtras } = {}) {
    const controller = new AbortController();
    const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      return await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        ...signalExtras,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    provider: "openrouter",
    messages: {
      async create(params, opts = {}) {
        const res = await post(toOpenAIRequest(params, config.openrouterModel), { timeout: opts.timeout });
        if (!res.ok) await throwHttpError(res);
        const data = await res.json();
        const text = stripJsonFences(data.choices?.[0]?.message?.content ?? "");
        return {
          content: [{ type: "text", text }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: data.usage?.prompt_tokens ?? 0,
            output_tokens: data.usage?.completion_tokens ?? 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        };
      },

      stream(params) {
        const handlers = {};
        const run = (async () => {
          const res = await post({ ...toOpenAIRequest(params, config.openrouterModel), stream: true });
          if (!res.ok) await throwHttpError(res);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let usage = null;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop();
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const chunk = JSON.parse(payload);
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) handlers.text?.(delta);
                if (chunk.usage) usage = chunk.usage;
              } catch {}
            }
          }
          return {
            stop_reason: "end_turn",
            usage: {
              input_tokens: usage?.prompt_tokens ?? 0,
              output_tokens: usage?.completion_tokens ?? 0,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          };
        })();
        return {
          on(event, cb) {
            handlers[event] = cb;
            return this;
          },
          finalMessage() {
            return run;
          },
        };
      },
    },
  };
}
