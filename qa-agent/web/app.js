/* Outskill AI Mentor — chat client. Vanilla JS, no build step.
   Streams POST /api/chat as SSE, renders markdown-lite safely, persists the
   session id locally and restores history from the server. */

(() => {
  const $ = (sel) => document.querySelector(sel);
  const chat = $("#chat");
  const input = $("#input");
  const form = $("#composer");
  const sendBtn = $("#sendBtn");
  const welcome = $("#welcome");
  const suggestionsEl = $("#suggestions");

  /* ---------- session ---------- */
  const newId = () => "s_" + crypto.getRandomValues(new Uint32Array(3)).reduce((a, n) => a + n.toString(36), "");
  let sessionId = localStorage.getItem("outskill_session") || newId();
  localStorage.setItem("outskill_session", sessionId);

  /* ---------- theme ---------- */
  const savedTheme = localStorage.getItem("outskill_theme");
  if (savedTheme) document.body.dataset.theme = savedTheme;
  else if (matchMedia("(prefers-color-scheme: light)").matches) document.body.dataset.theme = "light";
  $("#themeBtn").addEventListener("click", () => {
    document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("outskill_theme", document.body.dataset.theme);
  });

  $("#newChatBtn").addEventListener("click", () => {
    sessionId = newId();
    localStorage.setItem("outskill_session", sessionId);
    chat.querySelectorAll(".msg, .error-note").forEach((n) => n.remove());
    welcome.style.display = "";
    loadSuggestions();
    input.focus();
  });

  /* ---------- markdown-lite (escape first, then format) ---------- */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function md(text) {
    let t = esc(text);
    t = t.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.replace(/^\w+\n/, "")}</code></pre>`);
    t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|\n)\s*[-•]\s+(.+)/g, "$1<li>$2</li>");
    t = t.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
    return t
      .split(/\n{2,}/)
      .map((p) => (p.startsWith("<ul>") || p.startsWith("<pre>") ? p : `<p>${p.replace(/\n/g, "<br>")}</p>`))
      .join("");
  }

  /* ---------- rendering ---------- */
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };

  function addMsg(role, text) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = role === "user" ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : md(text);
    wrap.appendChild(bubble);
    chat.appendChild(wrap);
    scroll();
    return { wrap, bubble };
  }

  const icons = {
    copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
    up: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    down: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg)"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  };

  function addActions(wrap, bubble, messageId, existingFeedback) {
    const bar = document.createElement("div");
    bar.className = "msg-actions";
    const mk = (title, svg) => {
      const b = document.createElement("button");
      b.className = "act"; b.title = title; b.innerHTML = svg;
      bar.appendChild(b); return b;
    };
    const copyBtn = mk("Copy answer", icons.copy);
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(bubble.innerText);
      copyBtn.innerHTML = icons.check;
      setTimeout(() => (copyBtn.innerHTML = icons.copy), 1400);
    });
    if (messageId) {
      const upBtn = mk("Helpful", icons.up);
      const downBtn = mk("Not helpful", icons.down);
      const rate = async (rating, btn, other) => {
        btn.classList.add("on"); other.classList.remove("on"); bar.classList.add("stay");
        try {
          await fetch("/api/feedback", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, messageId, rating }),
          });
        } catch {}
      };
      upBtn.addEventListener("click", () => rate("up", upBtn, downBtn));
      downBtn.addEventListener("click", () => rate("down", downBtn, upBtn));
      if (existingFeedback === "up") { upBtn.classList.add("on"); bar.classList.add("stay"); }
      if (existingFeedback === "down") { downBtn.classList.add("on"); bar.classList.add("stay"); }
    }
    wrap.appendChild(bar);
  }

  function showError(text) {
    const div = document.createElement("div");
    div.className = "error-note";
    div.textContent = text;
    chat.appendChild(div);
    scroll();
  }

  /* ---------- suggestions ---------- */
  async function loadSuggestions(inline = false) {
    try {
      const res = await fetch(`/api/suggestions?sessionId=${encodeURIComponent(sessionId)}`);
      const { suggestions } = await res.json();
      const target = inline ? (() => {
        const c = document.createElement("div");
        c.className = "chips inline";
        chat.appendChild(c);
        return c;
      })() : suggestionsEl;
      target.innerHTML = "";
      for (const q of suggestions) {
        const chip = document.createElement("button");
        chip.className = "chip"; chip.type = "button"; chip.textContent = q;
        chip.addEventListener("click", () => { send(q); target.remove?.(); });
        target.appendChild(chip);
      }
      if (inline) scroll();
    } catch {}
  }

  /* ---------- SSE parsing ---------- */
  function parseSSE(buffer, onEvent) {
    // returns unconsumed remainder
    const events = buffer.split("\n\n");
    const rest = events.pop();
    for (const raw of events) {
      let event = "message", data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (data) { try { onEvent(event, JSON.parse(data)); } catch {} }
    }
    return rest;
  }

  /* ---------- send ---------- */
  let busy = false;

  async function send(text) {
    const msg = (text ?? input.value).trim();
    if (!msg || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = ""; autoGrow();
    welcome.style.display = "none";
    chat.querySelectorAll(".chips.inline").forEach((n) => n.remove());

    addMsg("user", msg);

    const { wrap, bubble } = addMsg("assistant", "");
    bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    wrap.classList.add("streaming");

    let answer = "";
    let messageId = null;
    let renderQueued = false;
    const render = () => {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => { bubble.innerHTML = md(answer); renderQueued = false; scroll(); });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let failed = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf = parseSSE(buf + decoder.decode(value, { stream: true }), (event, data) => {
          if (event === "delta") { answer += data.text; render(); }
          else if (event === "done") { messageId = data.messageId; }
          else if (event === "error") { failed = data.message; }
        });
      }
      if (failed && !answer) throw new Error(failed);
      wrap.classList.remove("streaming");
      bubble.innerHTML = md(answer || "…");
      addActions(wrap, bubble, messageId);
      loadSuggestions(true);
    } catch (err) {
      wrap.remove();
      showError(err.message || "Connection lost — please try again.");
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  /* ---------- composer behavior ---------- */
  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); send(); });

  /* ---------- restore ---------- */
  (async () => {
    loadSuggestions();
    try {
      const { version } = await (await fetch("/api/health")).json();
      const note = document.querySelector(".footnote");
      if (version && note) note.textContent += ` · build v${version}`;
    } catch {}
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(sessionId)}`);
      const { messages } = await res.json();
      if (messages.length) {
        welcome.style.display = "none";
        for (const m of messages) {
          const { wrap, bubble } = addMsg(m.role, m.content);
          if (m.role === "assistant") addActions(wrap, bubble, m.id, m.feedback);
        }
      }
    } catch {}
    input.focus();
  })();
})();
