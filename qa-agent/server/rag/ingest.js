import fs from "node:fs";
import path from "node:path";
import { parseFile, SUPPORTED } from "./parsers.js";
import { chunkDocument } from "./chunker.js";
import { buildIndex } from "./bm25.js";

export async function buildIndexFromDir(knowledgeDir) {
  const files = fs
    .readdirSync(knowledgeDir)
    .filter((f) => SUPPORTED.includes(path.extname(f).toLowerCase()))
    .sort();
  const chunks = [];
  for (const file of files) {
    const parsed = await parseFile(path.join(knowledgeDir, file));
    if (!parsed || !parsed.text.trim()) continue;
    chunks.push(...chunkDocument({ doc: file, title: parsed.title, text: parsed.text }));
  }
  const index = buildIndex(chunks);
  return { ...index, builtAt: new Date().toISOString(), docs: files };
}

export function saveIndex(index, indexPath) {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const tmp = `${indexPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index));
  fs.renameSync(tmp, indexPath);
}

export function loadIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}
