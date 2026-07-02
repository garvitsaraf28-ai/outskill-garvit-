// Heading-aware chunking (research report §2.3): authors already organize
// facts by topic, so heading boundaries beat fixed-size windows on curated
// docs. Tiny sections merge forward; oversized sections split by paragraph.

const MIN_WORDS = 40;
const MAX_WORDS = 450;
const TARGET_WORDS = 350;

const words = (s) => s.split(/\s+/).filter(Boolean).length;

function splitLong(text) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());
  const out = [];
  let buf = [];
  let count = 0;
  for (const p of paras) {
    const w = words(p);
    if (count + w > TARGET_WORDS && buf.length) {
      out.push(buf.join("\n\n"));
      buf = [];
      count = 0;
    }
    buf.push(p);
    count += w;
  }
  if (buf.length) out.push(buf.join("\n\n"));
  return out;
}

export function chunkDocument({ doc, title, text }) {
  const clean = text.replace(/<!--[\s\S]*?-->/g, "").trim();
  const lines = clean.split("\n");
  const sections = [];
  let heading = title;
  let path = [];
  let buf = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) sections.push({ heading: path.length ? path.join(" > ") : heading, text: body });
    buf = [];
  };

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      path = [...path.slice(0, level - 1)];
      path[level - 1] = m[2].trim();
      path = path.filter(Boolean);
      if (level === 1) {
        heading = m[2].trim();
        path = [];
      }
    } else {
      buf.push(line);
    }
  }
  flush();

  // Merge undersized sections into their successor so facts keep their context.
  const merged = [];
  for (const s of sections) {
    const prev = merged[merged.length - 1];
    if (prev && words(prev.text) < MIN_WORDS) {
      prev.text += `\n\n${s.heading}\n${s.text}`;
    } else {
      merged.push({ ...s });
    }
  }

  const chunks = [];
  for (const s of merged) {
    const pieces = words(s.text) > MAX_WORDS ? splitLong(s.text) : [s.text];
    for (const piece of pieces) {
      chunks.push({
        id: `${doc}#${chunks.length}`,
        doc,
        title,
        heading: s.heading,
        text: piece.trim(),
      });
    }
  }
  return chunks;
}
