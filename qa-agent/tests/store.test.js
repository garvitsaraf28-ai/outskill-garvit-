import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSessionStore } from "../server/store/sessionStore.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "qa-store-"));

test("rejects malformed session ids", () => {
  const store = createSessionStore({ dir: tmp() });
  assert.equal(store.validId("../../etc/passwd"), false);
  assert.equal(store.validId("short"), false);
  assert.equal(store.validId("s_abc123XYZ"), true);
  assert.equal(store.load("../../etc/passwd"), null);
});

test("ensure creates, load round-trips through disk", () => {
  const dir = tmp();
  const store = createSessionStore({ dir });
  const s = store.ensure("s_roundtrip1");
  store.appendMessage(s, { role: "user", content: "hello" });
  store.appendMessage(s, { role: "assistant", content: "hi!", sources: [{ doc: "faq.md", section: "x" }] });

  const fresh = createSessionStore({ dir }); // new instance, cold cache
  const loaded = fresh.load("s_roundtrip1");
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.messages[1].sources[0].doc, "faq.md");
  assert.equal(loaded.profile.profession, "unknown");
});

test("feedback attaches to the right message", () => {
  const store = createSessionStore({ dir: tmp() });
  const s = store.ensure("s_feedback01");
  const m = store.appendMessage(s, { role: "assistant", content: "answer" });
  assert.equal(store.setFeedback(s, m.id, "up"), true);
  assert.equal(store.setFeedback(s, "m_nope", "up"), false);
  assert.equal(s.messages[0].feedback, "up");
});
