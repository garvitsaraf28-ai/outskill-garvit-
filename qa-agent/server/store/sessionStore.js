import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { emptyProfile } from "../services/profileSchema.js";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

// File-backed with write-through memory cache. The interface (load/ensure/
// put/appendMessage/setFeedback) is the contract a Postgres/Redis store
// implements later (ADR-006). Writes are atomic (tmp + rename).
export function createSessionStore({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const cache = new Map();
  const file = (id) => path.join(dir, `${id}.json`);

  const persist = (session) => {
    session.updatedAt = Date.now();
    const tmp = `${file(session.id)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(session));
    fs.renameSync(tmp, file(session.id));
  };

  return {
    validId(id) {
      return typeof id === "string" && ID_RE.test(id);
    },
    load(id) {
      if (!this.validId(id)) return null;
      if (cache.has(id)) return cache.get(id);
      if (!fs.existsSync(file(id))) return null;
      const session = JSON.parse(fs.readFileSync(file(id), "utf8"));
      cache.set(id, session);
      return session;
    },
    ensure(id) {
      const existing = this.load(id);
      if (existing) return existing;
      if (!this.validId(id)) throw new Error("invalid session id");
      const session = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        profile: emptyProfile(),
        summary: "",
        messages: [],
      };
      cache.set(id, session);
      persist(session);
      return session;
    },
    put(session) {
      cache.set(session.id, session);
      persist(session);
    },
    appendMessage(session, { role, content, sources = null }) {
      const msg = {
        id: `m_${crypto.randomBytes(8).toString("hex")}`,
        role,
        content,
        ts: Date.now(),
        ...(sources ? { sources } : {}),
        feedback: null,
      };
      session.messages.push(msg);
      this.put(session);
      return msg;
    },
    setFeedback(session, messageId, feedback) {
      const msg = session.messages.find((m) => m.id === messageId);
      if (!msg) return false;
      msg.feedback = feedback;
      this.put(session);
      return true;
    },
  };
}
