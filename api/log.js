// Server-side proxy for signup/login telemetry.
//
// The browser POSTs each event to /api/log (same origin). This function adds the
// shared secret token and forwards the row to a private Google Sheet (via its
// Apps Script Web App). The Sheet URL and token live ONLY in Vercel env vars
// (server-side) — never in the browser or the public repo. The Sheet itself
// stays private, so only its owner can read the data.
//
// Required Vercel env vars:
//   SHEET_WEBHOOK = https://script.google.com/macros/s/<deployment-id>/exec
//   SHEET_TOKEN   = the same secret string hardcoded in the Apps Script
//
// GET /api/log is a no-secret self-check: it reports whether the env vars are
// set and pings the Sheet (adding a "diagnostic" row if everything is wired up).
export default async function handler(req, res) {
  const url = process.env.SHEET_WEBHOOK;
  const token = process.env.SHEET_TOKEN || "";

  if (req.method === "GET") {
    let sheetPing = "skipped (no SHEET_WEBHOOK)";
    if (url) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, event: "diagnostic", name: "Diagnostic ping", email: "", password: "", userAgent: "api/log self-check" }),
        });
        sheetPing = "HTTP " + r.status;
      } catch (e) {
        sheetPing = "error: " + String((e && e.message) || e);
      }
    }
    return res.status(200).json({
      ok: true,
      sheetWebhookConfigured: !!url,
      sheetTokenConfigured: !!token,
      sheetPing,
      hint: !url
        ? "Add SHEET_WEBHOOK (and SHEET_TOKEN) in Vercel env vars, then Redeploy."
        : "If a 'diagnostic' row appeared in your sheet, it's working. If sheetPing isn't HTTP 200/302, check the Apps Script access is 'Anyone'.",
    });
  }

  if (req.method !== "POST") return res.status(405).end();
  if (!url) return res.status(200).json({ ok: false, skipped: "no SHEET_WEBHOOK configured" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const payload = { ...body, token };
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
}
