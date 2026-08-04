#!/usr/bin/env node
// Rebuild the retrieval index after editing knowledge/.
// Usage: npm run ingest
import path from "node:path";
import { loadConfig } from "../server/config.js";
import { buildIndexFromDir, saveIndex } from "../server/rag/ingest.js";

const config = loadConfig();
const index = await buildIndexFromDir(config.knowledgeDir);
saveIndex(index, path.join(config.dataDir, "index.json"));
console.log(`Indexed ${index.docs.length} documents → ${index.N} chunks`);
for (const doc of index.docs) console.log(`  • ${doc}`);
