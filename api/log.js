// Server-side proxy for signup/login telemetry.
//
// The browser POSTs each event to /api/log (same origin). This function adds the
// shared secret token and forwards the row to a private Google Sheet (via its
// Apps Script Web App). The Sheet URL and the token live ONLY in Vercel env vars
// (server-side) — they never reach the browser or the public repo. The Sheet
// itself stays private to its owner, so only that owner can read the data.
//
// Required Vercel env vars:
//   SHEET_WEBHOOK = https://script.google.com/macros/s/<deployment-id>/exec
//   SHEET_TOKEN   = the same secret string hardcoded in the Apps Script
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const url = process.env.SHEET_WEBHOOK;
  // Not configured yet → succeed quietly so the app never errors on auth.
  if (!url) return res.status(200).json({ ok: false, skipped: "no SHEET_WEBHOOK configured" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const payload = { ...body, token: process.env.SHEET_TOKEN || "" };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    // Never block the user's signup/login on a logging hiccup.
    res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
}
