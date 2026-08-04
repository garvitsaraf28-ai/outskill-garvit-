import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { getSuggestions } from "./services/suggestions.js";

const COHORT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "cohort.json");

// Simple sliding-window rate limiter keyed by session+IP. In-memory: correct
// for a single process; move to Redis alongside the session store when
// scaling horizontally (deployment guide).
function createRateLimiter({ perMinute }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }, 30_000).unref();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => t > now - 60_000);
    arr.push(now);
    hits.set(key, arr);
    return arr.length <= perMinute;
  };
}

export function createApp({ config, chatService, sessions, feedback, retriever, signups, mentorQueue }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(config.webDir));

  const allow = createRateLimiter({ perMinute: config.rateLimitPerMin });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, version: config.version, index: retriever.stats() });
  });

  // Quick sign-up: name + contact so mentors know who to reply to.
  app.post("/api/signup", (req, res) => {
    const { sessionId, name, contact } = req.body || {};
    const cleanName = String(name || "").trim().slice(0, 60);
    const cleanContact = String(contact || "").trim().slice(0, 80);
    if (!sessions.validId(String(sessionId || ""))) return res.status(400).json({ error: "invalid sessionId" });
    if (cleanName.length < 2) return res.status(400).json({ error: "name required" });
    if (cleanContact.length < 5) return res.status(400).json({ error: "WhatsApp number or email required" });
    const session = sessions.ensure(String(sessionId));
    session.user = { name: cleanName, contact: cleanContact };
    sessions.put(session);
    signups?.append({ sessionId: session.id, name: cleanName, contact: cleanContact });
    res.json({ ok: true });
  });

  // Mentor hand-off: log the question for the mentor team and hand back a
  // prefilled WhatsApp link. No AI call — humans answer this lane.
  app.post("/api/mentor-question", (req, res) => {
    const { sessionId, message } = req.body || {};
    const msg = typeof message === "string" ? message.trim() : "";
    if (!sessions.validId(String(sessionId || ""))) return res.status(400).json({ error: "invalid sessionId" });
    if (!msg) return res.status(400).json({ error: "message required" });
    if (msg.length > config.maxMessageChars) return res.status(400).json({ error: "message too long" });
    if (!allow(`${sessionId}:${req.ip}`)) return res.status(429).json({ error: "Too many messages — give it a minute." });

    const session = sessions.ensure(String(sessionId));
    const user = session.user || {};
    sessions.appendMessage(session, { role: "user", content: msg, mode: "mentor" });
    const ack =
      `✅ **Your question is with our mentor team.** We're assigning a mentor to you now — ` +
      `you'll get a personal reply on WhatsApp${user.contact ? ` at **${user.contact}**` : ""}.\n\n` +
      `Want it even faster? Send it to us on WhatsApp directly with the button below.`;
    const saved = sessions.appendMessage(session, { role: "assistant", content: ack, mode: "mentor" });
    mentorQueue?.append({
      sessionId: session.id,
      name: user.name || "",
      contact: user.contact || "",
      profession: session.profile?.profession || "unknown",
      question: msg,
    });
    const waText = encodeURIComponent(
      `Hi Outskill team! I'm ${user.name || "a session participant"}. My question from the session: ${msg}`
    );
    res.json({
      ok: true,
      messageId: saved.id,
      ack,
      waLink: `https://wa.me/${config.mentorWhatsApp}?text=${waText}`,
    });
  });

  app.get("/api/cohort", (_req, res) => {
    try {
      const { _note, ...cohort } = JSON.parse(fs.readFileSync(COHORT_FILE, "utf8"));
      res.json(cohort);
    } catch {
      res.status(500).json({ error: "cohort data unavailable" });
    }
  });

  app.get("/api/suggestions", (req, res) => {
    const session = sessions.load(String(req.query.sessionId || ""));
    res.json({ suggestions: getSuggestions(session?.profile) });
  });

  app.get("/api/history/:sessionId", (req, res) => {
    const session = sessions.load(req.params.sessionId);
    if (!session) return res.json({ messages: [] });
    res.json({
      messages: session.messages.map(({ id, role, content, ts, feedback: fb, mode }) => ({ id, role, content, ts, feedback: fb, mode })),
    });
  });

  app.post("/api/feedback", (req, res) => {
    const { sessionId, messageId, rating, comment } = req.body || {};
    if (!["up", "down"].includes(rating)) return res.status(400).json({ error: "rating must be up|down" });
    const session = sessions.load(String(sessionId || ""));
    if (!session) return res.status(404).json({ error: "unknown session" });
    if (!sessions.setFeedback(session, String(messageId || ""), rating)) {
      return res.status(404).json({ error: "unknown message" });
    }
    feedback.append({ sessionId: session.id, messageId, rating, comment: String(comment || "").slice(0, 1000) });
    res.json({ ok: true });
  });

  app.post("/api/chat", async (req, res) => {
    const { sessionId, message, mode } = req.body || {};
    const msg = typeof message === "string" ? message.trim() : "";
    if (!sessions.validId(String(sessionId || ""))) {
      return res.status(400).json({ error: "invalid sessionId (6-64 chars, [A-Za-z0-9_-])" });
    }
    if (!msg) return res.status(400).json({ error: "message required" });
    if (msg.length > config.maxMessageChars) {
      return res.status(400).json({ error: `message too long (max ${config.maxMessageChars} chars)` });
    }
    if (!allow(`${sessionId}:${req.ip}`)) {
      return res.status(429).json({ error: "Too many messages — give it a minute." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event, data) => {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await chatService.handleMessage({ sessionId, message: msg, send, mode: mode === "agent" ? "agent" : "mentor" });
    } catch (err) {
      send("error", { message: "Something went wrong — please try again." });
      console.error("[api/chat]", err);
    } finally {
      res.end();
    }
  });

  return app;
}
