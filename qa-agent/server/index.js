import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { loadPrompts } from "./prompts/build.js";
import { createAnthropicClient } from "./services/anthropic.js";
import { createProfiler } from "./services/profiler.js";
import { createChatService } from "./services/chat.js";
import { createRetriever } from "./rag/retriever.js";
import { createSessionStore } from "./store/sessionStore.js";
import { createFeedbackStore } from "./store/feedbackStore.js";
import { createApp } from "./app.js";

// Load .env if present (no dotenv dependency needed for a flat file).
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const config = loadConfig();
const prompts = loadPrompts(config.promptsDir);
const client = createAnthropicClient(config);
const retriever = await createRetriever({ knowledgeDir: config.knowledgeDir, dataDir: config.dataDir });
const sessions = createSessionStore({ dir: path.join(config.dataDir, "sessions") });
const feedback = createFeedbackStore({ file: path.join(config.dataDir, "feedback.jsonl") });
const profiler = createProfiler({ client, config, prompts });
const chatService = createChatService({ client, config, prompts, retriever, sessions, profiler });

const app = createApp({ config, chatService, sessions, feedback, retriever });

if (!config.apiKey && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn("⚠️  ANTHROPIC_API_KEY is not set — the UI will load but chat calls will fail. See .env.example.");
}

app.listen(config.port, () => {
  const stats = retriever.stats();
  console.log(`Outskill AI Mentor listening on http://localhost:${config.port}`);
  console.log(`Knowledge index: ${stats.docs} docs, ${stats.chunks} chunks (built ${stats.builtAt})`);
});
