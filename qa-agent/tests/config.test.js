import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../server/config.js";

test("OpenRouter key saved under ANTHROPIC_API_KEY is auto-routed to free mode", () => {
  const c = loadConfig({ ANTHROPIC_API_KEY: "sk-or-v1-abc123" });
  assert.equal(c.apiKey, "");
  assert.equal(c.openrouterKey, "sk-or-v1-abc123");
});

test("Claude key saved under OPENROUTER_API_KEY is auto-routed to Claude", () => {
  const c = loadConfig({ OPENROUTER_API_KEY: "sk-ant-api03-xyz" });
  assert.equal(c.apiKey, "sk-ant-api03-xyz");
  assert.equal(c.openrouterKey, "");
});

test("keys are trimmed of whitespace and quotes", () => {
  const c = loadConfig({ ANTHROPIC_API_KEY: '  "sk-ant-api03-xyz"  ' });
  assert.equal(c.apiKey, "sk-ant-api03-xyz");
  const c2 = loadConfig({ OPENROUTER_API_KEY: " sk-or-v1-abc " });
  assert.equal(c2.openrouterKey, "sk-or-v1-abc");
});

test("correctly-placed keys pass through unchanged", () => {
  const c = loadConfig({ ANTHROPIC_API_KEY: "sk-ant-a", OPENROUTER_API_KEY: "sk-or-b" });
  assert.equal(c.apiKey, "sk-ant-a");
  assert.equal(c.openrouterKey, "sk-or-b");
});
