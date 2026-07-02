# ADR-003 — Lexical BM25 retrieval (pure JS), dense/hybrid as upgrade path

**Status:** Accepted

## Context
Grounding requires retrieval over a curated corpus (~10–50 Markdown docs, keyword-heavy
facts: prices, EMI routes, tool names, schedules). Constraints: Anthropic-only (no
first-party embeddings endpoint exists), lightweight, no extra services.

## Decision
Okapi BM25 (k1=1.5, b=0.75) implemented in ~150 lines of dependency-free JS, over
heading-aware chunks, with a JSON-persisted index rebuilt by `scripts/ingest.js`.
`retriever.js` exposes `retrieve(query, opts) → [{chunk, score}]` so the ranking engine is
swappable.

## Rationale
- **Corpus shape favors lexical.** Queries are keyword-rich ("price", "EMI", "n8n",
  "certificate", "refund"); BM25 excels exactly here. BEIR-style evaluations consistently
  show BM25 as a competitive baseline that dense retrieval only clearly beats on large,
  paraphrase-heavy corpora.
- **Vendor constraint.** Dense retrieval would force a second AI vendor (Voyage, Cohere,
  OpenAI) for embeddings — against the project's explicit constraint — plus a vector store.
- **Ops weight.** Zero services, deterministic scoring, index inspectable as JSON. A wrong
  answer is debuggable by reading the index.
- **Chunking dominates.** At this corpus size, answer quality moves with corpus curation and
  chunk boundaries far more than with the ranker; we invest there (heading-aware chunker,
  doc/section metadata in prompts).

## Mitigations for BM25's paraphrase weakness
1. Corpus written with synonym-rich headings and an explicit FAQ file (questions phrased the
   way participants ask them).
2. Query augmentation with session context terms (profession, program under discussion).
3. Retrieval misses fail safe: the answer prompt forbids specific program-fact claims when
   context is empty.

## Upgrade path (when corpus > ~200 docs or paraphrase misses show up in feedback)
Implement `retriever.js` as hybrid: BM25 + embedding similarity with reciprocal-rank fusion;
the orchestrator and prompt builder are unchanged.
