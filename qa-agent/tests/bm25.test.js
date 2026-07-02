import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildIndex, search } from "../server/rag/bm25.js";

const chunks = [
  { id: "a", doc: "pricing.md", title: "Pricing", heading: "Price", text: "India price is ₹94,999. International price is $2,995. Zero-cost EMI available." },
  { id: "b", doc: "curriculum.md", title: "Curriculum", heading: "Day 3", text: "AI automations with n8n: replace repetitive tasks and build a lead-management system." },
  { id: "c", doc: "faq.md", title: "FAQ", heading: "Certificate", text: "NSDC Skill India certified program for India only." },
];

test("tokenize lowercases, strips stopwords, light-singularizes", () => {
  const t = tokenize("The Prices and the EMIs are for India");
  assert.ok(t.includes("price"));
  assert.ok(t.includes("emi"));
  assert.ok(t.includes("india"));
  assert.ok(!t.includes("the"));
  assert.ok(!t.includes("and"));
});

test("search ranks the pricing chunk first for a price query", () => {
  const index = buildIndex(chunks);
  const results = search(index, "how much does it cost price EMI");
  assert.ok(results.length >= 1);
  assert.equal(results[0].chunk.id, "a");
});

test("search finds n8n chunk for automation query", () => {
  const index = buildIndex(chunks);
  const results = search(index, "what is n8n automation");
  assert.equal(results[0].chunk.id, "b");
});

test("no-match query returns empty", () => {
  const index = buildIndex(chunks);
  assert.deepEqual(search(index, "quantum blockchain zebra"), []);
});

test("long-tail results below the score floor are dropped", () => {
  const index = buildIndex(chunks);
  const results = search(index, "n8n lead management automation india", { minRatio: 0.5 });
  // "india" alone matches a & c weakly; floor keeps only strong matches
  assert.equal(results[0].chunk.id, "b");
  assert.ok(results.every((r) => r.score >= results[0].score * 0.5));
});
