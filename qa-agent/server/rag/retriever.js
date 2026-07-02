import path from "node:path";
import { search } from "./bm25.js";
import { buildIndexFromDir, loadIndex, saveIndex } from "./ingest.js";

// Narrow interface (retrieve/stats) so the ranking engine can become hybrid
// BM25+dense later (ADR-003) without touching the chat orchestrator.
export async function createRetriever({ knowledgeDir, dataDir }) {
  const indexPath = path.join(dataDir, "index.json");
  let index = loadIndex(indexPath);
  if (!index) {
    index = await buildIndexFromDir(knowledgeDir);
    saveIndex(index, indexPath);
  }

  return {
    retrieve(query, { k = 6, augment = [] } = {}) {
      const q = [query, ...augment].join(" ");
      return search(index, q, { k }).map(({ chunk, score }) => ({
        doc: chunk.doc,
        title: chunk.title,
        heading: chunk.heading,
        text: chunk.text,
        score,
      }));
    },
    async reindex() {
      index = await buildIndexFromDir(knowledgeDir);
      saveIndex(index, indexPath);
      return this.stats();
    },
    stats() {
      return { docs: index.docs?.length ?? 0, chunks: index.N, builtAt: index.builtAt };
    },
  };
}
