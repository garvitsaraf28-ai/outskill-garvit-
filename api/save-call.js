// Saves one completed mock call to the shared team store (Upstash Redis) AND
// appends a row to the Google Sheet (via Apps Script webhook), if configured.
// The client also keeps its own localStorage copy, so if nothing is configured
// this is a harmless no-op and nothing breaks.
import { isConfigured, cmd, PRACTICE_KEY } from "./_kv.js";

// Pushes one row to the Google Sheet via the Apps Script webhook.
// URL lives in a Vercel env var — never hardcoded.
async function syncToSheet(entry) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  const card = entry.card || {};
  const topStrength = Array.isArray(card.strengths) && card.strengths.length ? card.strengths[0] : "";
  const biggestGap = Array.isArray(card.lostPoints) && card.lostPoints.length ? card.lostPoints[0] : "";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: entry.ts,
        rep: entry.rep,
        mode: entry.mode,
        persona: entry.persona,
        difficulty: entry.difficulty,
        duration: entry.duration,
        overall: entry.overall,
        correctRouting: entry.correctRouting,
        topStrength,
        biggestGap,
      }),
    });
  } catch {
    // Never block the user's flow on a sync hiccup.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
      // full scorecard (strengths, lostPoints, missed, sayNextTime, behavioral, flags)
      card: b.card && typeof b.card === "object" ? b.card : null,
    };
    if (entry.overall === null) return res.json({ ok: true, stored: false });

    // Save to Redis (team dashboard) if configured.
    if (isConfigured()) {
      await cmd(["LPUSH", PRACTICE_KEY, JSON.stringify(entry)]);
      await cmd(["LTRIM", PRACTICE_KEY, "0", "999"]); // cap at 1000 most-recent
    }

    // Append a row to the Google Sheet (independent of Redis).
    await syncToSheet(entry);

    res.json({ ok: true, stored: isConfigured(), id: entry.id });
  } catch (e) {
    // Never block the user's flow on a storage hiccup.
    res.json({ ok: true, stored: false, error: String(e.message || e) });
  }
}
