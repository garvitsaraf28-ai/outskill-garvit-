import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrompts, systemBlocks, buildUserTurn, buildMessages } from "../server/prompts/build.js";
import { emptyProfile } from "../server/services/profileSchema.js";

const promptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "prompts");

test("system prompt loads, carries compliance rules, and is cache-marked", () => {
  const prompts = loadPrompts(promptsDir);
  const blocks = systemBlocks(prompts);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].cache_control, { type: "ephemeral" });
  const sys = blocks[0].text;
  for (const marker of ["Never promise", "discount", "NSDC", "Engineering Accelerator", "never expose", "<learner_profile>"]) {
    assert.ok(sys.toLowerCase().includes(marker.toLowerCase()), `system prompt mentions "${marker}"`);
  }
});

test("user turn contains profile, context with provenance, and the message", () => {
  const profile = { ...emptyProfile(), profession: "hr", market: "india", objections: ["not_technical"] };
  const turn = buildUserTurn({
    message: "How is this useful for me?",
    profile,
    chunks: [{ title: "Pricing", heading: "Price", text: "India ₹94,999", doc: "04.md", score: 3 }],
    summary: "Participant is exploring options.",
  });
  assert.ok(turn.includes("<learner_profile>"));
  assert.ok(turn.includes("profession: hr"));
  assert.ok(turn.includes("objections raised so far: not_technical"));
  assert.ok(turn.includes("<retrieved_context>"));
  assert.ok(turn.includes("Pricing — Price"));
  assert.ok(turn.includes("<conversation_summary>"));
  assert.ok(turn.trim().endsWith("</user_message>"));
});

test("empty retrieval injects the no-facts guard instead of nothing", () => {
  const turn = buildUserTurn({ message: "hi", profile: emptyProfile(), chunks: [], summary: "" });
  assert.ok(turn.includes("do not state specific program facts"));
});

test("buildMessages places history before the composed user turn", () => {
  const msgs = buildMessages({
    windowMessages: [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
    ],
    userTurn: "<user_message>q2</user_message>",
  });
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].content, "q1");
  assert.equal(msgs[2].role, "user");
  assert.ok(msgs[2].content.includes("q2"));
});
