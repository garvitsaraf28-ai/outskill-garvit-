import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function loadConfig(env = process.env) {
  return {
    root: ROOT,
    port: int(env.PORT, 8787),
    apiKey: env.ANTHROPIC_API_KEY || "",
    openrouterKey: env.OPENROUTER_API_KEY || "",
    // Comma-separated fallback chain — tried in order when a free model is
    // rate-limited or unavailable (free models are shared and often congested).
    openrouterModel:
      env.OPENROUTER_MODEL ||
      "meta-llama/llama-3.3-70b-instruct:free,nvidia/nemotron-3-super-120b-a12b:free",
    openrouterBaseUrl: env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    answerModel: env.ANSWER_MODEL || "claude-opus-4-8",
    profileModel: env.PROFILE_MODEL || "claude-opus-4-8",
    summaryModel: env.SUMMARY_MODEL || "claude-opus-4-8",
    answerMaxTokens: int(env.ANSWER_MAX_TOKENS, 4096),
    profileTimeoutMs: int(env.PROFILE_TIMEOUT_MS, 2500),
    historyWindow: int(env.HISTORY_WINDOW, 12),
    retrieveK: int(env.RETRIEVE_K, 6),
    rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 20),
    maxMessageChars: int(env.MAX_MESSAGE_CHARS, 4000),
    knowledgeDir: env.KNOWLEDGE_DIR || path.join(ROOT, "knowledge"),
    dataDir: env.DATA_DIR || path.join(ROOT, "data"),
    webDir: path.join(ROOT, "web"),
    promptsDir: path.join(ROOT, "server", "prompts"),
  };
}
