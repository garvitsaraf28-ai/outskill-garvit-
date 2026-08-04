import { mergeProfile } from "./profileSchema.js";
import { systemBlocks, buildUserTurn, buildMessages, MODES } from "../prompts/build.js";

const TRIVIAL_RE = /^(hi|hello|hey|thanks?|thank you|ok(ay)?|cool|great|nice|got it|👍|🙏)[.! ]*$/i;

// Translate API failures into messages that tell the operator/user exactly
// what to do — a generic "snag" hides the fix (key, credits, rate limit).
export function friendlyApiError(err) {
  const status = err?.status;
  const text = String(err?.message || "");
  if (status === 401 || /authentication|x-api-key|auth credentials/i.test(text)) {
    return "⚠️ Setup issue: the API key is missing or invalid. Fix: stop the app, delete the .env file in the app folder, start it again and paste the key exactly — an OpenRouter key (sk-or-…) or a Claude key (sk-ant-…), the whole thing, nothing else.";
  }
  if (/credit|billing|balance/i.test(text)) {
    return "⚠️ Setup issue: your Anthropic account has no credits. Add credits at console.anthropic.com → Settings → Billing (minimum $5), then ask again — no restart needed.";
  }
  if (status === 403) {
    return "⚠️ Setup issue: this API key doesn't have permission for the model. Check the key's workspace at console.anthropic.com or create a fresh key.";
  }
  if (status === 404 && /model/i.test(text)) {
    return "⚠️ Setup issue: the configured model isn't available to this account. Remove any ANSWER_MODEL override from .env, or check model access at console.anthropic.com.";
  }
  if (status === 429) {
    return "The AI is rate-limited right now — wait a minute and ask again.";
  }
  if (status >= 500 || /overloaded/i.test(text)) {
    return "Claude is temporarily overloaded — please try again in a few seconds.";
  }
  if (/fetch failed|ENOTFOUND|ECONN|network|Connection error/i.test(text)) {
    return "⚠️ Can't reach the Anthropic API from this machine — check your internet connection, VPN, or firewall.";
  }
  return "I hit a snag answering that — please try again in a few seconds.";
}

// The orchestrator: profile + retrieve in parallel → merged profile →
// streamed answer → persist → async compaction. Fully dependency-injected so
// tests run without network (ADR-006). See docs/02-architecture.md §2.
export function createChatService({ client, config, prompts, retriever, sessions, logger = console, profiler }) {
  const systemByMode = {
    mentor: systemBlocks(prompts, "mentor"),
    agent: systemBlocks(prompts, "agent"),
  };

  function augmentTerms(profile) {
    const terms = [];
    if (profile.profession !== "unknown") terms.push(profile.profession.replace(/_/g, " "));
    if (profile.market !== "unknown") terms.push(profile.market);
    return terms;
  }

  async function compact(session) {
    const excess = session.messages.length - config.historyWindow;
    if (excess < 8) return; // compact in batches, not every turn
    const old = session.messages.slice(0, excess);
    const keep = session.messages.slice(excess);
    const turns = old.map((m) => `${m.role === "user" ? "Participant" : "Mentor"}: ${m.content}`).join("\n");
    try {
      const resp = await client.messages.create({
        model: config.summaryModel,
        max_tokens: 600,
        system: prompts.summarizer,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: `<existing_summary>\n${session.summary || "(empty)"}\n</existing_summary>\n\n<turns_to_fold_in>\n${turns}\n</turns_to_fold_in>`,
          },
        ],
      });
      const text = resp.content.find((b) => b.type === "text")?.text?.trim();
      if (text) {
        session.summary = text;
        session.messages = keep;
        sessions.put(session);
      }
    } catch (err) {
      logger.warn(`[compact] skipped: ${err.message}`); // turns are already persisted; retry next time
    }
  }

  return {
    /**
     * @param {{sessionId: string, message: string, send: (event: string, data: object) => void}} args
     * @returns {Promise<void>} resolves when the SSE stream is complete
     */
    async handleMessage({ sessionId, message, send, mode = "mentor" }) {
      if (!MODES.includes(mode)) mode = "mentor";
      const session = sessions.ensure(sessionId);
      const trivial = TRIVIAL_RE.test(message.trim());

      const recentText = session.messages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .slice(-1500);

      const [observation, chunks] = await Promise.all([
        trivial ? Promise.resolve(null) : profiler.classify({ message, recentText }),
        Promise.resolve(
          trivial ? [] : retriever.retrieve(message, { k: config.retrieveK, augment: augmentTerms(session.profile) })
        ),
      ]);

      session.profile = mergeProfile(session.profile, observation);

      const sources = chunks.map((c) => ({ doc: c.doc, section: c.heading }));
      send("meta", {
        mode,
        profile: {
          profession: session.profile.profession,
          market: session.profile.market,
          sentiment: session.profile.sentiment,
        },
        sources,
      });

      const userTurn = buildUserTurn({
        message,
        profile: session.profile,
        chunks,
        summary: session.summary,
      });
      const windowMessages = session.messages.slice(-config.historyWindow);

      sessions.appendMessage(session, { role: "user", content: message });

      let answer = "";
      try {
        const stream = client.messages.stream({
          model: config.answerModel,
          max_tokens: config.answerMaxTokens,
          thinking: { type: "adaptive" },
          system: systemByMode[mode],
          messages: buildMessages({ windowMessages, userTurn }),
        });
        stream.on("text", (delta) => {
          answer += delta;
          send("delta", { text: delta });
        });
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          answer = answer || "I can't help with that one — but I'm all yours for anything about AI or the programs.";
          send("delta", { text: answer });
        }
        const saved = sessions.appendMessage(session, { role: "assistant", content: answer, sources, mode });
        send("done", {
          messageId: saved.id,
          mode,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
            cacheRead: final.usage.cache_read_input_tokens,
            cacheWrite: final.usage.cache_creation_input_tokens,
          },
        });
        compact(session).catch(() => {}); // off the request path by design (ADR-004)
      } catch (err) {
        logger.error(`[chat] answer failed: ${err.status || ""} ${err.message}`);
        send("error", { message: friendlyApiError(err) });
      }
    },
  };
}
