// Saves one completed practice call to the shared team store (Upstash Redis).
// The client also keeps its own localStorage copy, so if no DB is configured
// this is a harmless no-op and nothing breaks.
import { isConfigured, cmd, PRACTICE_KEY } from "./_kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isConfigured()) return res.json({ ok: true, stored: false });

  try {
    const b = req.body || {};
    // Only persist the lightweight scorecard summary — never the transcript.
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: b.ts || Date.now(),
      rep: (b.rep || "").toString().slice(0, 60).trim() || "Anonymous",
      mode: b.mode || "learner",
      persona: b.persona || "",
      personaTag: b.personaTag || "",
      difficulty: b.difficulty || "",
      duration: b.duration || "",
      overall: typeof b.overall === "number" ? b.overall : null,
      correctRouting: !!b.correctRouting,
      categories: Array.isArray(b.categories) ? b.categories : [],
    };
    if (entry.overall === null) return res.json({ ok: true, stored: false });

    await cmd(["LPUSH", PRACTICE_KEY, JSON.stringify(entry)]);
    await cmd(["LTRIM", PRACTICE_KEY, "0", "999"]); // cap at 1000 most-recent
    res.json({ ok: true, stored: true, id: entry.id });
  } catch (e) {
    // Never block the user's flow on a storage hiccup.
    res.json({ ok: true, stored: false, error: String(e.message || e) });
  }
}
