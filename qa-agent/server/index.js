import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { loadPrompts } from "./prompts/build.js";
import { createModelClient } from "./services/anthropic.js";
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
const client = createModelClient(config);
const retriever = await createRetriever({ knowledgeDir: config.knowledgeDir, dataDir: config.dataDir });
const sessions = createSessionStore({ dir: path.join(config.dataDir, "sessions") });
const feedback = createFeedbackStore({ file: path.join(config.dataDir, "feedback.jsonl") });
const signups = createFeedbackStore({ file: path.join(config.dataDir, "signups.jsonl") });
const mentorQueue = createFeedbackStore({ file: path.join(config.dataDir, "mentor-questions.jsonl") });
const profiler = createProfiler({ client, config, prompts });
const chatService = createChatService({ client, config, prompts, retriever, sessions, profiler });

const app = createApp({ config, chatService, sessions, feedback, retriever, signups, mentorQueue });

if (config.apiKey) {
  console.log(`Provider: Claude (${config.answerModel})`);
} else if (config.openrouterKey) {
  console.log(`Provider: OpenRouter FREE mode (${config.openrouterModel}) — fine for testing; use a Claude key for real events.`);
} else if (!process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn("⚠️  No API key set (ANTHROPIC_API_KEY or OPENROUTER_API_KEY) — the UI will load but chat calls will fail. See .env.example.");
}

const server = app.listen(config.port, () => {
  const stats = retriever.stats();
  console.log(`Outskill AI Mentor v${config.version} listening on http://localhost:${config.port}`);
  console.log(`Knowledge index: ${stats.docs} docs, ${stats.chunks} chunks (built ${stats.builtAt})`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("");
    console.error(`❌ Port ${config.port} is already in use — ANOTHER COPY of the mentor is already running.`);
    console.error("   Close every other black window (or restart the computer), then start this one again.");
    console.error("");
    process.exit(1);
  }
  throw err;
});
