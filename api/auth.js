// Shared account registry — one account per email, across every device.
//   POST {action:"signup", name, email, password} → creates the account;
//        409 {error:"exists"} if that email already signed up anywhere.
//   POST {action:"login", email, password} → 404 no account, 401 wrong password.
// Backed by the shared Upstash Redis store. If the store isn't configured the
// response carries {configured:false} and the client falls back to its
// device-local registry (the pre-existing behaviour). Passwords are stored
// only as salted SHA-256 hashes — never in plain text.
import crypto from "crypto";
import { isConfigured, cmd } from "./_kv.js";

const ACCOUNTS_KEY = "saraf_accounts_v1";
const hashPw = (email, pw) =>
  crypto.createHash("sha256").update(`saraf:${email}:${pw}`).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isConfigured()) return res.json({ ok: false, configured: false });
  try {
    const b = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const action = (b.action || "").toString();
    const email = (b.email || "").toString().trim().toLowerCase();
    const password = (b.password || "").toString();
    if (!email || !password) return res.status(400).json({ ok: false, configured: true, error: "missing_fields" });

    const existingRaw = await cmd(["HGET", ACCOUNTS_KEY, email]);
    let existing = null;
    try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch {}

    if (action === "signup") {
      const name = (b.name || "").toString().trim().slice(0, 60);
      if (!name) return res.status(400).json({ ok: false, configured: true, error: "missing_fields" });
      if (existing) return res.status(409).json({ ok: false, configured: true, error: "exists" });
      const acc = { name, email, hash: hashPw(email, password), role: "New joiner", createdAt: Date.now() };
      // HSETNX so two simultaneous signups with the same email can't both win.
      const created = await cmd(["HSETNX", ACCOUNTS_KEY, email, JSON.stringify(acc)]);
      if (!created) return res.status(409).json({ ok: false, configured: true, error: "exists" });
      return res.json({ ok: true, configured: true, user: { name, email, role: acc.role } });
    }

    if (action === "login") {
      if (!existing) return res.status(404).json({ ok: false, configured: true, error: "not_found" });
      if (existing.hash !== hashPw(email, password)) {
        return res.status(401).json({ ok: false, configured: true, error: "wrong_password" });
      }
      return res.json({ ok: true, configured: true, user: { name: existing.name, email, role: existing.role || "New joiner" } });
    }

    return res.status(400).json({ ok: false, configured: true, error: "bad_action" });
  } catch (e) {
    // A store hiccup shouldn't lock people out — report unconfigured so the
    // client falls back to its device-local registry.
    return res.json({ ok: false, configured: false, error: String((e && e.message) || e) });
  }
}
