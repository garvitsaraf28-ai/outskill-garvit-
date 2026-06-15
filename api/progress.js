// Team progress sync for the Manager view.
//   POST  — a rep upserts their onboarding snapshot (one row per email).
//   GET   — a manager reads every rep's latest snapshot (optionally gated by
//           a MANAGER_KEY env var: if set, ?key= must match).
// Backed by the shared Upstash Redis store (graceful no-op if not configured —
// the app keeps working off each browser's localStorage either way). No
// transcripts and no passwords are ever stored here.
import { isConfigured, cmd } from "./_kv.js";

const PROGRESS_KEY = "saraf_progress_v1";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const need = process.env.MANAGER_KEY;
    if (need && (req.query.key || "") !== need) return res.status(403).json({ ok: false, error: "bad_key" });
    if (!isConfigured()) return res.json({ ok: true, configured: false, reps: [] });
    try {
      const flat = (await cmd(["HGETALL", PROGRESS_KEY])) || [];
      const reps = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        try { reps.push(JSON.parse(flat[i + 1])); } catch {}
      }
      return res.json({ ok: true, configured: true, reps });
    } catch (e) {
      return res.json({ ok: true, configured: false, reps: [], error: String((e && e.message) || e) });
    }
  }

  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const email = (b.email || "").toString().toLowerCase().trim();
    if (!email) return res.json({ ok: false, error: "no_email" });
    const snap = {
      email,
      name: (b.name || "").toString().slice(0, 60),
      completion: Math.max(0, Math.min(100, Number(b.completion) || 0)),
      done: Number(b.done) || 0,
      readiness: (b.readiness || "").toString().slice(0, 40),
      knowledge: b.knowledge == null ? null : Number(b.knowledge),
      callAvg: b.callAvg == null ? null : Number(b.callAvg),
      calls: Number(b.calls) || 0,
      weakSkill: (b.weakSkill || "").toString().slice(0, 40),
      ts: Date.now(),
    };
    if (isConfigured()) await cmd(["HSET", PROGRESS_KEY, email, JSON.stringify(snap)]);
    res.json({ ok: true, stored: isConfigured() });
  } catch (e) {
    res.json({ ok: false, error: String((e && e.message) || e) });
  }
}
