import fs from "node:fs";
import path from "node:path";

// Core formats parse dependency-free. PDF/DOCX use optional parsers installed
// on demand, so the base install stays two-dependency (ADR-006).

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(h[1-3])[^>]*>/gi, "\n## ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function csvToText(csv) {
  const rows = csv.split(/\r?\n/).filter((r) => r.trim());
  if (rows.length === 0) return "";
  const split = (r) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(rows[0]);
  return rows
    .slice(1)
    .map((r) => split(r).map((cell, i) => `${header[i] || `col${i}`}: ${cell}`).join("; "))
    .join("\n");
}

async function optionalDep(name, hint) {
  try {
    return await import(name);
  } catch {
    throw new Error(`Parsing this file needs the optional dependency "${name}". Install it: npm i ${name} ${hint || ""}`.trim());
  }
}

export async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  const firstHeading = (text) => /^#\s+(.+)$/m.exec(text)?.[1];

  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    const text = fs.readFileSync(filePath, "utf8");
    return { title: firstHeading(text) || base, text };
  }
  if (ext === ".html" || ext === ".htm") {
    const raw = fs.readFileSync(filePath, "utf8");
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(raw)?.[1]?.trim();
    return { title: title || base, text: stripHtml(raw) };
  }
  if (ext === ".csv") {
    return { title: base, text: csvToText(fs.readFileSync(filePath, "utf8")) };
  }
  if (ext === ".pdf") {
    const mod = await optionalDep("pdf-parse");
    const buf = fs.readFileSync(filePath);
    if (mod.PDFParse) {
      // pdf-parse v2 class API
      const result = await new mod.PDFParse({ data: new Uint8Array(buf) }).getText();
      return { title: base, text: result.text };
    }
    const data = await mod.default(buf); // legacy v1 function API
    return { title: base, text: data.text };
  }
  if (ext === ".docx") {
    const mammoth = await optionalDep("mammoth");
    const { value } = await mammoth.extractRawText({ path: filePath });
    return { title: base, text: value };
  }
  return null; // unsupported extension — caller skips it
}

export const SUPPORTED = [".md", ".markdown", ".txt", ".html", ".htm", ".csv", ".pdf", ".docx"];
