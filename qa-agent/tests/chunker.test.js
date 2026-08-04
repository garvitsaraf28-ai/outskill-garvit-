import test from "node:test";
import assert from "node:assert/strict";
import { chunkDocument } from "../server/rag/chunker.js";

test("splits on headings and keeps heading paths", () => {
  const text = `# Program

Intro paragraph with enough words to stand alone as a section for the test to
verify basic splitting behavior of the chunker across heading boundaries okay
this is now long enough to not be merged away by the minimum size rule because
it has more than forty words in total which is the documented threshold value.

## Price

India price is ₹94,999 and the international price is $2,995 for the program
which is a fact-dense section that should become its own chunk with the Price
heading attached to it so retrieval can show provenance to the model clearly
and this sentence pads it beyond the minimum word count threshold for chunks.`;
  const chunks = chunkDocument({ doc: "t.md", title: "Program", text });
  assert.ok(chunks.length >= 2);
  const price = chunks.find((c) => c.heading.includes("Price"));
  assert.ok(price, "price section chunked");
  assert.ok(price.text.includes("94,999"));
  assert.equal(price.doc, "t.md");
});

test("merges tiny sections instead of emitting fragments", () => {
  const text = `# Doc

## Tiny

One line.

## Next

${"word ".repeat(60)}`;
  const chunks = chunkDocument({ doc: "t.md", title: "Doc", text });
  assert.ok(!chunks.some((c) => c.text.trim() === "One line."), "tiny section merged");
});

test("splits oversized sections by paragraph", () => {
  const para = `${"lorem ipsum dolor sit amet consectetur ".repeat(30)}`;
  const text = `# Doc\n\n## Big\n\n${para}\n\n${para}\n\n${para}`;
  const chunks = chunkDocument({ doc: "t.md", title: "Doc", text });
  assert.ok(chunks.length >= 2, "oversized section split");
  for (const c of chunks) {
    assert.ok(c.text.split(/\s+/).length <= 460, "each chunk within max size");
  }
});

test("strips HTML comments (editorial notes never reach the model)", () => {
  const text = `# Doc\n\n<!-- internal note -->\n\n${"content ".repeat(50)}`;
  const chunks = chunkDocument({ doc: "t.md", title: "Doc", text });
  assert.ok(!chunks.some((c) => c.text.includes("internal note")));
});
