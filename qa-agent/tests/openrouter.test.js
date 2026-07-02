import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenRouterClient, toOpenAIRequest } from "../server/services/openrouter.js";
import { createChatService } from "../server/services/chat.js";
import { createProfiler } from "../server/services/profiler.js";
import { createSessionStore } from "../server/store/sessionStore.js";
import { createRetriever } from "../server/rag/retriever.js";
import { loadPrompts } from "../server/prompts/build.js";
import { loadConfig } from "../server/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(here, "..", "server", "prompts");

const PROFILE = {
  profession: "marketing", professionConfidence: 0.9, experienceLevel: "mid_career",
  aiFamiliarity: "basic", careerStage: "employed", market: "india",
  sentiment: "curious", intent: "application_question",
  objections: [], goals: [], messageLanguage: "en",
};

// Minimal OpenAI-compatible mock: non-stream requests get a JSON body
// (profiler), stream requests get SSE chunks (answer).
function mockOpenRouter() {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      if (parsed.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const piece of ["Marketers ", "use AI ", "for campaigns."]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 50, completion_tokens: 6 } })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(PROFILE) } }],
          usage: { prompt_tokens: 40, completion_tokens: 30 },
        }));
      }
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

test("toOpenAIRequest maps system blocks, history, and json-schema mode", () => {
  const req = toOpenAIRequest(
    {
      system: [{ type: "text", text: "You are a mentor." }],
      messages: [
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "q2" },
      ],
      max_tokens: 512,
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    },
    "some/model:free"
  );
  assert.equal(req.model, "some/model:free");
  assert.equal(req.messages[0].role, "system");
  assert.ok(req.messages[0].content.includes("You are a mentor."));
  assert.ok(req.messages[0].content.includes("JSON schema"));
  assert.equal(req.messages.length, 4);
  assert.deepEqual(req.response_format, { type: "json_object" });
});

test("full chat pipeline works end-to-end on the OpenRouter adapter", async () => {
  const server = await mockOpenRouter();
  const { port } = server.address();
  const config = loadConfig({
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_BASE_URL: `http://127.0.0.1:${port}/api/v1`,
  });
  const client = createOpenRouterClient(config);
  const prompts = loadPrompts(promptsDir);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-or-"));
  const retriever = await createRetriever({ knowledgeDir: config.knowledgeDir, dataDir });
  const sessions = createSessionStore({ dir: path.join(dataDir, "sessions") });
  const profiler = createProfiler({ client, config, prompts, logger: { warn() {} } });
  const service = createChatService({ client, config, prompts, retriever, sessions, profiler, logger: { warn() {}, error() {} } });

  const events = [];
  await service.handleMessage({
    sessionId: "s_ortest0001",
    message: "I'm in marketing — how do people use AI for campaigns?",
    send: (event, data) => events.push({ event, data }),
  });
  server.close();

  assert.equal(events[0].event, "meta");
  assert.equal(events[0].data.profile.profession, "marketing", "profiler JSON parsed via adapter");
  const answer = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  assert.equal(answer, "Marketers use AI for campaigns.");
  assert.equal(events.at(-1).event, "done");
  assert.equal(events.at(-1).data.usage.output, 6);
});

test("adapter surfaces HTTP errors with status for friendly mapping", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Invalid API key" } }));
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const client = createOpenRouterClient(
    loadConfig({ OPENROUTER_API_KEY: "sk-or-bad", OPENROUTER_BASE_URL: `http://127.0.0.1:${port}/api/v1` })
  );
  await assert.rejects(
    () => client.messages.stream({ system: "s", messages: [{ role: "user", content: "x" }], max_tokens: 10 }).finalMessage(),
    (err) => err.status === 401 && /Invalid API key/.test(err.message)
  );
  server.close();
});
