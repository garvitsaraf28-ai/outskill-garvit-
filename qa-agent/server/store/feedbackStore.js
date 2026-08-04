import fs from "node:fs";
import path from "node:path";

// Append-only JSONL: the raw material of the weekly evaluation loop
// (docs/09-evaluation.md). One line per rating event.
export function createFeedbackStore({ file }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return {
    append(entry) {
      fs.appendFileSync(file, JSON.stringify({ ts: Date.now(), ...entry }) + "\n");
    },
  };
}
