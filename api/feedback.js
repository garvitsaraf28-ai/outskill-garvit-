// Public feedback wall. GET returns all reviews (most-recent first);
// POST adds one review. Names are public — everyone sees everyone's.
import { isConfigured, cmd, FEEDBACK_KEY } from "./_kv.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!isConfigured()) return res.json({ configured: false, reviews: [] });
    try {
      const rows = await cmd(["LRANGE", FEEDBACK_KEY, "0", "499"]);
      const reviews = (rows || [])
        .map((r) => { try { return JSON.parse(r); } catch { return null; } })
        .filter(Boolean);
      return res.json({ configured: true, reviews });
    } catch (e) {
      return res.json({ configured: false, reviews: [], error: String(e.message || e) });
    }
  }

  if (req.method === "POST") {
    if (!isConfigured()) {
      return res.status(503).json({ ok: false, error: "Feedback storage isn't connected yet." });
    }
    try {
      const b = req.body || {};
      const name = (b.name || "").toString().trim().slice(0, 60);
      const comment = (b.comment || "").toString().trim().slice(0, 1000);
      const rating = Math.max(1, Math.min(5, Math.round(Number(b.rating) || 0)));
      if (!name) return res.status(400).json({ ok: false, error: "Please add your name." });
      if (!comment) return res.status(400).json({ ok: false, error: "Please write a comment." });
      if (!rating) return res.status(400).json({ ok: false, error: "Please give a rating." });

      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        name, comment, rating,
      };
      await cmd(["LPUSH", FEEDBACK_KEY, JSON.stringify(entry)]);
      await cmd(["LTRIM", FEEDBACK_KEY, "0", "499"]); // keep 500 most-recent
      return res.json({ ok: true, review: entry });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }

  return res.status(405).end();
}
