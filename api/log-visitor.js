import { isConfigured, cmd } from "./_kv.js";

const VISITORS_KEY = "saraf_visitors_v1";

export default async function handler(req, res) {
  if (req.method === "POST") {
    if (!isConfigured()) return res.json({ ok: true, stored: false });
    try {
      const name = ((req.body || {}).name || "").toString().trim().slice(0, 60);
      if (!name) return res.json({ ok: false });
      const entry = { name, ts: Date.now(), id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}` };
      await cmd(["LPUSH", VISITORS_KEY, JSON.stringify(entry)]);
      await cmd(["LTRIM", VISITORS_KEY, "0", "499"]);
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
