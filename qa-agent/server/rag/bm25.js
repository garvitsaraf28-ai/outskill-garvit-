// Okapi BM25 over the chunked knowledge corpus. Dependency-free by design
// (ADR-003): at this corpus size a transparent lexical ranker beats the
// operational weight of a vector stack, and every score is reproducible.

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have i if in into is it its me my of on or " +
    "our so than that the their them then there these they this to was we what when where " +
    "which who will with you your can do does did not no yes am").split(" ")
);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9₹$%.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

export function buildIndex(chunks, { k1 = 1.5, b = 0.75 } = {}) {
  const df = Object.create(null);
  const HEADING_WEIGHT = 3; // heading terms are the author's own topic labels — count them extra
  const indexed = chunks.map((chunk) => {
    const terms = Object.create(null);
    for (const t of tokenize(chunk.text)) {
      terms[t] = (terms[t] || 0) + 1;
    }
    for (const t of tokenize(`${chunk.title} ${chunk.heading}`)) {
      terms[t] = (terms[t] || 0) + HEADING_WEIGHT;
    }
    for (const t of Object.keys(terms)) df[t] = (df[t] || 0) + 1;
    return { ...chunk, terms, len: Object.values(terms).reduce((a, n) => a + n, 0) };
  });
  const avgdl =
    indexed.length === 0
      ? 0
      : indexed.reduce((a, c) => a + c.len, 0) / indexed.length;
  return { k1, b, avgdl, N: indexed.length, df, chunks: indexed };
}

export function search(index, query, { k = 6, minRatio = 0.25 } = {}) {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0 || index.N === 0) return [];
  const { k1, b, avgdl, N, df } = index;
  const scored = [];
  for (const chunk of index.chunks) {
    let score = 0;
    for (const t of qTerms) {
      const f = chunk.terms[t];
      if (!f) continue;
      const n = df[t] || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * chunk.len) / avgdl));
    }
    if (score > 0) scored.push({ chunk, score });
  }
  scored.sort((a, b2) => b2.score - a.score);
  const top = scored.slice(0, k);
  if (top.length === 0) return [];
  // Drop long-tail matches that only share an incidental term with the query.
  const floor = top[0].score * minRatio;
  return top.filter((s) => s.score >= floor);
}
