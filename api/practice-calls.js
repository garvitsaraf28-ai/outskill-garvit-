// Returns every practice call from the shared team store (most-recent first).
// The client groups these by rep name into "mine" vs "everyone else".
import { isConfigured, cmd, PRACTICE_KEY } from "./_kv.js";

export default async function handler(req, res) {
  if (!isConfigured()) return res.json({ configured: false, calls: [] });
  try {
    const rows = await cmd(["LRANGE", PRACTICE_KEY, "0", "999"]);
    const calls = (rows || [])
      .map((r) => { try { return JSON.parse(r); } catch { return null; } })
      .filter(Boolean);
    res.json({ configured: true, calls });
  } catch (e) {
    res.json({ configured: false, calls: [], error: String(e.message || e) });
  }
}
