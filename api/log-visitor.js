import { isConfigured, cmd } from "./_kv.js";

const VISITORS_KEY = "saraf_visitors_v1";
const NOTIFY_EMAIL = "garvitsaraf28@gmail.com";

async function sendEmailNotification(name) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "OutSkill Sales <onboarding@resend.dev>",
      to: [NOTIFY_EMAIL],
      subject: `👋 ${name} just opened OutSkill Sales`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0c08;color:#e7eadd;border-radius:16px;overflow:hidden">
          <div style="background:#c2ee45;padding:20px 28px">
            <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#0a0c08">OutSkill Sales · Visitor Alert</div>
          </div>
          <div style="padding:28px">
            <div style="font-size:42px;margin-bottom:8px">👋</div>
            <h2 style="margin:0 0 8px;font-size:24px;color:#c2ee45">${name}</h2>
            <p style="margin:0 0 20px;font-size:16px;color:#9aa090">just opened the OutSkill Sales platform.</p>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:14px 18px;font-size:13px;color:#9aa090">
              🕐 <strong style="color:#e7eadd">${time} IST</strong>
            </div>
            <p style="margin:24px 0 0;font-size:12px;color:#555">This notification was sent by Saraf.AI — OutSkill Sales Command Center.</p>
          </div>
        </div>
      `,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const name = ((req.body || {}).name || "").toString().trim().slice(0, 60);
      if (!name) return res.json({ ok: false });

      const entry = { name, ts: Date.now(), id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}` };

      // Save to DB (if configured)
      if (isConfigured()) {
        await cmd(["LPUSH", VISITORS_KEY, JSON.stringify(entry)]);
        await cmd(["LTRIM", VISITORS_KEY, "0", "499"]);
      }

      // Send email notification (fire and forget — never blocks the user)
      sendEmailNotification(name).catch(() => {});

      return res.json({ ok: true });
    } catch (e) {
      return res.json({ ok: true, stored: false });
    }
  }

  if (req.method === "GET") {
    if (!isConfigured()) return res.json({ configured: false, visitors: [] });
    try {
      const rows = await cmd(["LRANGE", VISITORS_KEY, "0", "499"]);
      const visitors = (rows || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
      return res.json({ configured: true, visitors });
    } catch (e) {
      return res.json({ configured: false, visitors: [] });
    }
  }

  return res.status(405).end();
}
