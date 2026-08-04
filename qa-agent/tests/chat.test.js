import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createChatService } from "../server/services/chat.js";
import { createProfiler } from "../server/services/profiler.js";
import { createSessionStore } from "../server/store/sessionStore.js";
import { createRetriever } from "../server/rag/retriever.js";
import { loadPrompts } from "../server/prompts/build.js";
import { loadConfig } from "../server/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(here, "..", "server", "prompts");

// Hermetic fake for the Anthropic SDK surface the app uses.
function fakeClient({ answerText, profileJson }) {
  const calls = { create: [], stream: [] };
  return {
    calls,
    messages: {
      async create(params) {
        calls.create.push(params);
        return { content: [{ type: "text", text: JSON.stringify(profileJson) }], stop_reason: "end_turn" };
      },
      stream(params) {
        calls.stream.push(params);
        const handlers = {};
        return {
          on(ev, cb) { handlers[ev] = cb; return this; },
          async finalMessage() {
            for (const piece of answerText.match(/.{1,12}/gs) || []) handlers.text?.(piece);
            return {
              stop_reason: "end_turn",
              usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
            };
          },
        };
      },
    },
  };
}

async function makeService({ client }) {
  const config = loadConfig({});
  const prompts = loadPrompts(promptsDir);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-chat-"));
  const retriever = await createRetriever({ knowledgeDir: config.knowledgeDir, dataDir });
  const sessions = createSessionStore({ dir: path.join(dataDir, "sessions") });
  const profiler = createProfiler({ client, config, prompts, logger: { warn() {} } });
  const service = createChatService({
    client, config, prompts, retriever, sessions, profiler, logger: { warn() {}, error() {} },
  });
  return { service, sessions, config };
}

const HR_PROFILE = {
  profession: "hr", professionConfidence: 0.95, experienceLevel: "senior",
  aiFamiliarity: "basic", careerStage: "employed", market: "india",
  sentiment: "curious", intent: "application_question",
  objections: [], goals: ["automate_work"], messageLanguage: "en",
};

test("full turn: meta → deltas → done, personalized prompt, session persisted", async () => {
  const client = fakeClient({ answerText: "For HR, start with resume screening automation.", profileJson: HR_PROFILE });
  const { service, sessions } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000001",
    message: "I am an HR manager — how is this useful for me?",
    send: (event, data) => events.push({ event, data }),
  });

  // SSE contract
  assert.equal(events[0].event, "meta");
  assert.equal(events[0].data.profile.profession, "hr");
  assert.ok(events[0].data.sources.length > 0, "retrieval produced sources");
  const answer = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  assert.equal(answer, "For HR, start with resume screening automation.");
  const done = events.at(-1);
  assert.equal(done.event, "done");
  assert.ok(done.data.messageId.startsWith("m_"));
  assert.equal(done.data.usage.cacheRead, 800);

  // Answer request shape
  const req = client.calls.stream[0];
  assert.equal(req.thinking.type, "adaptive");
  assert.deepEqual(req.system[0].cache_control, { type: "ephemeral" });
  const userTurn = req.messages.at(-1).content;
  assert.ok(userTurn.includes("profession: hr"));
  assert.ok(userTurn.includes("<retrieved_context>"));

  // Persistence
  const session = sessions.load("s_test000001");
  assert.equal(session.messages.length, 2);
  assert.equal(session.profile.profession, "hr");
  assert.equal(session.profile.market, "india");
});

test("profiler failure degrades gracefully — answer still streams", async () => {
  const client = fakeClient({ answerText: "Here's the answer anyway.", profileJson: HR_PROFILE });
  client.messages.create = async () => { throw new Error("boom"); };
  const { service } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000002",
    message: "What does the Accelerator cost?",
    send: (event, data) => events.push({ event, data }),
  });
  assert.equal(events[0].data.profile.profession, "unknown");
  assert.equal(events.at(-1).event, "done");
});

test("answer-call failure emits a friendly SSE error, not a crash", async () => {
  const client = fakeClient({ answerText: "", profileJson: HR_PROFILE });
  client.messages.stream = () => ({ on() { return this; }, async finalMessage() { throw new Error("api down"); } });
  const { service } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000003",
    message: "hello there, what is an LLM?",
    send: (event, data) => events.push({ event, data }),
  });
  assert.equal(events.at(-1).event, "error");
  assert.ok(events.at(-1).data.message.length > 0);
});

test("trivial greeting skips profiler and retrieval", async () => {
  const client = fakeClient({ answerText: "Hey! Ask me anything about AI or the programs.", profileJson: HR_PROFILE });
  const { service } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000004",
    message: "hi",
    send: (event, data) => events.push({ event, data }),
  });
  assert.equal(client.calls.create.length, 0, "no profiler call for a greeting");
  assert.deepEqual(events[0].data.sources, []);
  assert.equal(events.at(-1).event, "done");
});

test("pricing question retrieves the pricing document", async () => {
  const client = fakeClient({ answerText: "₹94,999 in India.", profileJson: { ...HR_PROFILE, intent: "pricing_question" } });
  const { service } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000005",
    message: "How much does the Accelerator cost and is EMI available?",
    send: (event, data) => events.push({ event, data }),
  });
  const sources = events[0].data.sources.map((s) => s.doc);
  assert.ok(sources.includes("04-pricing-and-payments.md"), `expected pricing doc in ${sources}`);
});

test("API errors map to actionable messages", async () => {
  const { friendlyApiError } = await import("../server/services/chat.js");
  assert.match(friendlyApiError({ status: 401, message: "authentication_error" }), /API key is missing or invalid/);
  assert.match(friendlyApiError({ status: 400, message: "Your credit balance is too low" }), /no credits/);
  assert.match(friendlyApiError({ status: 429, message: "rate_limit_error" }), /rate-limited/);
  assert.match(friendlyApiError({ status: 529, message: "overloaded_error" }), /overloaded/);
  assert.match(friendlyApiError({ message: "Connection error: fetch failed" }), /reach the Anthropic API/);
  assert.match(friendlyApiError({ message: "something odd" }), /snag/);
});

test("agent mode uses the AI Agent system prompt and labels the message", async () => {
  const client = fakeClient({ answerText: "₹94,999 in India. EMI: 3/6/9/12 months, zero-cost.", profileJson: HR_PROFILE });
  const { service, sessions } = await makeService({ client });

  const events = [];
  await service.handleMessage({
    sessionId: "s_test000006",
    message: "price and EMI options, quick",
    mode: "agent",
    send: (event, data) => events.push({ event, data }),
  });
  assert.equal(events[0].data.mode, "agent");
  assert.ok(client.calls.stream[0].system[0].text.includes("Outskill AI Agent"));
  assert.equal(events.at(-1).data.mode, "agent");
  const session = sessions.load("s_test000006");
  assert.equal(session.messages.at(-1).mode, "agent");
});

test("invalid mode falls back to mentor", async () => {
  const client = fakeClient({ answerText: "ok", profileJson: HR_PROFILE });
  const { service } = await makeService({ client });
  const events = [];
  await service.handleMessage({
    sessionId: "s_test000007",
    message: "what is an LLM in simple words?",
    mode: "hacker",
    send: (event, data) => events.push({ event, data }),
  });
  assert.equal(events[0].data.mode, "mentor");
  assert.ok(client.calls.stream[0].system[0].text.includes("official AI Response Agent"));
});
