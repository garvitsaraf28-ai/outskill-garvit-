import fs from "node:fs";
import path from "node:path";

// The system prompt must stay byte-stable across requests: it is the cached
// prefix (cache_control on its last block). Everything per-user/per-turn goes
// into the user message instead.
export function loadPrompts(promptsDir) {
  const read = (f) => fs.readFileSync(path.join(promptsDir, f), "utf8").trim();
  return {
    system: read("system.md"), // Mentor mode
    agent: read("agent.md"),   // AI Agent mode (fast, precise)
    profiler: read("profiler.md"),
    summarizer: read("summarizer.md"),
  };
}

export const MODES = ["mentor", "agent"];

export function systemBlocks(prompts, mode = "mentor") {
  return [
    {
      type: "text",
      text: mode === "agent" ? prompts.agent : prompts.system,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function profileLines(profile) {
  const known = (v) => v && v !== "unknown";
  const lines = [];
  if (known(profile.profession)) lines.push(`profession: ${profile.profession}`);
  if (known(profile.experienceLevel)) lines.push(`experience: ${profile.experienceLevel}`);
  if (known(profile.aiFamiliarity)) lines.push(`ai familiarity: ${profile.aiFamiliarity}`);
  if (known(profile.careerStage)) lines.push(`career stage: ${profile.careerStage}`);
  if (known(profile.market)) lines.push(`market: ${profile.market}`);
  if (profile.sentiment) lines.push(`current sentiment: ${profile.sentiment}`);
  if (profile.intent) lines.push(`current intent: ${profile.intent}`);
  if (profile.objections?.length) lines.push(`objections raised so far: ${profile.objections.join(", ")}`);
  if (profile.goals?.length) lines.push(`goals expressed: ${profile.goals.join(", ")}`);
  if (profile.messageLanguage && profile.messageLanguage !== "en")
    lines.push(`writes in: ${profile.messageLanguage}`);
  return lines.length ? lines.join("\n") : "nothing known yet";
}

export function buildUserTurn({ message, profile, chunks, summary }) {
  const parts = [];
  if (summary) {
    parts.push(`<conversation_summary>\n${summary}\n</conversation_summary>`);
  }
  parts.push(`<learner_profile>\n${profileLines(profile)}\n</learner_profile>`);
  if (chunks?.length) {
    const ctx = chunks
      .map((c, i) => `[${i + 1}] ${c.title} — ${c.heading}\n${c.text}`)
      .join("\n\n");
    parts.push(`<retrieved_context>\n${ctx}\n</retrieved_context>`);
  } else {
    parts.push(
      `<retrieved_context>\n(none found — do not state specific program facts, prices, or dates; offer to have the team confirm)\n</retrieved_context>`
    );
  }
  parts.push(`<user_message>\n${message}\n</user_message>`);
  return parts.join("\n\n");
}

export function buildMessages({ windowMessages, userTurn }) {
  const history = windowMessages.map((m) => ({ role: m.role, content: m.content }));
  return [...history, { role: "user", content: userTurn }];
}
