#!/usr/bin/env node
// Golden-set evaluation (docs/09-evaluation.md).
//
//   node scripts/eval.js              → retrieval-only mode (no API key needed):
//                                       asserts each question retrieves its expected doc.
//   node scripts/eval.js --full       → full pipeline (needs ANTHROPIC_API_KEY):
//                                       runs profile→retrieve→answer, asserts
//                                       mustMatch / mustNotMatch regexes on the answer.
//   node scripts/eval.js --full --tag compliance   → filter by tag.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../server/config.js";
import { loadPrompts } from "../server/prompts/build.js";
import { createRetriever } from "../server/rag/retriever.js";
import { createSessionStore } from "../server/store/sessionStore.js";
import { createProfiler } from "../server/services/profiler.js";
import { createChatService } from "../server/services/chat.js";
import { createAnthropicClient } from "../server/services/anthropic.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const FULL = args.includes("--full");
const tagIdx = args.indexOf("--tag");
const TAG = tagIdx >= 0 ? args[tagIdx + 1] : null;

const config = loadConfig();
const cases = JSON.parse(fs.readFileSync(path.join(here, "..", "eval", "golden.json"), "utf8"))
  .filter((c) => !TAG || c.tags.includes(TAG));

const retriever = await createRetriever({
  knowledgeDir: config.knowledgeDir,
  dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "qa-eval-")),
});

let pass = 0, fail = 0;
const failures = [];

function check(ok, id, detail) {
  if (ok) pass++;
  else { fail++; failures.push(`${id}: ${detail}`); }
}

if (!FULL) {
  console.log(`Retrieval-only eval — ${cases.length} cases\n`);
  for (const c of cases) {
    const docs = retriever.retrieve(c.question, { k: config.retrieveK }).map((r) => r.doc);
    const hit = c.expectDocs.some((d) => docs.includes(d));
    check(hit, c.id, `expected one of [${c.expectDocs}], got [${docs}]`);
    console.log(`${hit ? "✅" : "❌"} ${c.id}`);
  }
} else {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Full mode needs ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN).");
    process.exit(2);
  }
  console.log(`Full-pipeline eval — ${cases.length} cases (this makes real API calls)\n`);
  const prompts = loadPrompts(config.promptsDir);
  const client = createAnthropicClient(config);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-eval-full-"));
  const sessions = createSessionStore({ dir: path.join(dataDir, "sessions") });
  const profiler = createProfiler({ client, config, prompts });
  const service = createChatService({ client, config, prompts, retriever, sessions, profiler });

  for (const c of cases) {
    let answer = "";
    let errored = null;
    await service.handleMessage({
      sessionId: `s_eval${Math.random().toString(36).slice(2, 12)}`,
      message: c.question,
      send: (event, data) => {
        if (event === "delta") answer += data.text;
        if (event === "error") errored = data.message;
      },
    });
    if (errored) { check(false, c.id, `pipeline error: ${errored}`); console.log(`❌ ${c.id} (error)`); continue; }
    let ok = true;
    for (const re of c.mustMatch) {
      if (!new RegExp(re, "i").test(answer)) { ok = false; check(false, c.id, `missing /${re}/ in: ${answer.slice(0, 200)}…`); }
    }
    for (const re of c.mustNotMatch) {
      if (new RegExp(re, "i").test(answer)) { ok = false; check(false, c.id, `FORBIDDEN /${re}/ matched in: ${answer.slice(0, 200)}…`); }
    }
    if (ok) { pass++; console.log(`✅ ${c.id}`); }
    else console.log(`❌ ${c.id}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  • ${f}`);
}
process.exit(fail ? 1 : 0);
