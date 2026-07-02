import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { createSessionStore } from "../server/store/sessionStore.js";
import { createFeedbackStore } from "../server/store/feedbackStore.js";
import { loadConfig } from "../server/config.js";

function makeApp() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-api-"));
  const config = loadConfig({ DATA_DIR: dataDir });
  const sessions = createSessionStore({ dir: path.join(dataDir, "sessions") });
  const signups = createFeedbackStore({ file: path.join(dataDir, "signups.jsonl") });
  const mentorQueue = createFeedbackStore({ file: path.join(dataDir, "mentor-questions.jsonl") });
  const feedback = createFeedbackStore({ file: path.join(dataDir, "feedback.jsonl") });
  const app = createApp({
    config,
    chatService: { async handleMessage() {} },
    sessions,
    feedback,
    signups,
    mentorQueue,
    retriever: { stats: () => ({ docs: 0, chunks: 0 }) },
  });
  return { app, sessions, dataDir };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function post(port, route, body) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test("signup stores the user on the session and logs it", async () => {
  const { app, sessions, dataDir } = makeApp();
  const server = await listen(app);
  const { port } = server.address();

  const ok = await post(port, "/api/signup", { sessionId: "s_api000001", name: "Tanish Atreya", contact: "+91 9999999999" });
  assert.equal(ok.status, 200);
  assert.equal(sessions.load("s_api000001").user.name, "Tanish Atreya");
  assert.ok(fs.readFileSync(path.join(dataDir, "signups.jsonl"), "utf8").includes("Tanish"));

  const bad = await post(port, "/api/signup", { sessionId: "s_api000001", name: "T", contact: "x" });
  assert.equal(bad.status, 400);
  server.close();
});

test("mentor question queues for the team and returns a prefilled WhatsApp link", async () => {
  const { app, sessions, dataDir } = makeApp();
  const server = await listen(app);
  const { port } = server.address();

  await post(port, "/api/signup", { sessionId: "s_api000002", name: "Priya", contact: "+91 8888888888" });
  const res = await post(port, "/api/mentor-question", { sessionId: "s_api000002", message: "Is the Accelerator right for a team lead?" });
  assert.equal(res.status, 200);
  assert.ok(res.body.waLink.startsWith("https://wa.me/918147069639?text="));
  assert.ok(decodeURIComponent(res.body.waLink).includes("Priya"));
  assert.ok(res.body.ack.includes("mentor team"));

  const session = sessions.load("s_api000002");
  assert.equal(session.messages.length, 2);
  assert.equal(session.messages[0].mode, "mentor");

  const queue = fs.readFileSync(path.join(dataDir, "mentor-questions.jsonl"), "utf8");
  assert.ok(queue.includes("team lead"));
  assert.ok(queue.includes("Priya"));
  server.close();
});
