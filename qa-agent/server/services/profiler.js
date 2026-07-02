import { PROFILE_JSON_SCHEMA } from "./profileSchema.js";

// One joint structured-output classification per user message (ADR-005).
// Runs in parallel with retrieval; bounded by a timeout so a slow classifier
// never delays the answer — on failure the previous profile is used.
export function createProfiler({ client, config, prompts, logger = console }) {
  return {
    async classify({ message, recentText }) {
      try {
        const resp = await client.messages.create(
          {
            model: config.profileModel,
            max_tokens: 512,
            system: prompts.profiler,
            output_config: {
              effort: "low",
              format: { type: "json_schema", schema: PROFILE_JSON_SCHEMA },
            },
            messages: [
              {
                role: "user",
                content:
                  `<recent_context>\n${recentText || "(first message)"}\n</recent_context>\n\n` +
                  `<message>\n${message}\n</message>`,
              },
            ],
          },
          { timeout: config.profileTimeoutMs, maxRetries: 0 }
        );
        const text = resp.content.find((b) => b.type === "text")?.text;
        return text ? JSON.parse(text) : null;
      } catch (err) {
        logger.warn(`[profiler] degraded to previous profile: ${err.message}`);
        return null;
      }
    },
  };
}
