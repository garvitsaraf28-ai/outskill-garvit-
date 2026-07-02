import express from "express";
import { getSuggestions } from "./services/suggestions.js";

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

export function createApp({ config, chatService, sessions, feedback, retriever }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(config.webDir));

  const allow = createRateLimiter({ perMinute: config.rateLimitPerMin });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, index: retriever.stats() });
  });

  app.get("/api/suggestions", (req, res) => {
    const session = sessions.load(String(req.query.sessionId || ""));
    res.json({ suggestions: getSuggestions(session?.profile) });
  });

  app.get("/api/history/:sessionId", (req, res) => {
    const session = sessions.load(req.params.sessionId);
    if (!session) return res.json({ messages: [] });
    res.json({
      messages: session.messages.map(({ id, role, content, ts, feedback: fb }) => ({ id, role, content, ts, feedback: fb })),
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
    const { sessionId, message } = req.body || {};
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
      await chatService.handleMessage({ sessionId, message: msg, send });
    } catch (err) {
      send("error", { message: "Something went wrong — please try again." });
      console.error("[api/chat]", err);
    } finally {
      res.end();
    }
  });

  return app;
}
