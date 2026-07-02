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

  /* ---------- quick sign-up ---------- */
  let user = null;
  try { user = JSON.parse(localStorage.getItem("outskill_user")); } catch {}
  const overlay = $("#signupOverlay");
  if (!user?.name) overlay.hidden = false;
  $("#signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#suName").value.trim();
    const contact = $("#suContact").value.trim();
    if (name.length < 2 || contact.length < 5) return;
    user = { name, contact };
    localStorage.setItem("outskill_user", JSON.stringify(user));
    overlay.hidden = true;
    try {
      await fetch("/api/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, contact }),
      });
    } catch {}
    const h1 = document.querySelector("#welcome h1");
    if (h1) h1.textContent = `Ask me anything, ${name.split(" ")[0]}.`;
    input.focus();
  });
  if (user?.name) {
    const h1 = document.querySelector("#welcome h1");
    if (h1) h1.textContent = `Ask me anything, ${user.name.split(" ")[0]}.`;
    fetch("/api/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, name: user.name, contact: user.contact }),
    }).catch(() => {});
  }

  /* ---------- mode (Mentor vs AI Agent) ---------- */
  let mode = localStorage.getItem("outskill_mode") || "agent";
  const mentorBtn = $("#modeMentor");
  const agentBtn = $("#modeAgent");
  function renderMode() {
    mentorBtn.classList.toggle("on", mode === "mentor");
    agentBtn.classList.toggle("on", mode === "agent");
    mentorBtn.setAttribute("aria-selected", mode === "mentor");
    agentBtn.setAttribute("aria-selected", mode === "agent");
    input.placeholder = mode === "agent" ? "Ask for an instant answer…" : "Ask your question — a mentor will reply on WhatsApp…";
  }
  mentorBtn.addEventListener("click", () => { mode = "mentor"; localStorage.setItem("outskill_mode", mode); renderMode(); input.focus(); });
  agentBtn.addEventListener("click", () => { mode = "agent"; localStorage.setItem("outskill_mode", mode); renderMode(); input.focus(); });
  renderMode();

  /* ---------- cohort panel ---------- */
  (async () => {
    try {
      const c = await (await fetch("/api/cohort")).json();
      if (c.headline) $("#cohortHeadline").textContent = c.headline;
      if (c.subline) $("#cohortSubline").textContent = c.subline;
      $("#cohortStats").innerHTML = (c.verifiedStats || [])
        .map((s) => `<div class="stat-card"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
        .join("");
      if (c.seniorSpotlight) {
        $("#seniorSpotlight").innerHTML =
          `<div class="sc-title">${esc(c.seniorSpotlight.title)}</div>` +
          `<div class="sc-roles">${(c.seniorSpotlight.roles || []).map((r) => `<i>${esc(r)}</i>`).join("")}</div>`;
      }
      const max = Math.max(...(c.mix || []).map((m) => m.pct), 1);
      $("#cohortMix").innerHTML = (c.mix || [])
        .map(
          (m) =>
            `<div class="mix-row${m.senior ? " senior" : ""}">` +
            `<div class="mr-top"><b>${esc(m.label)}</b><span>${m.pct}%</span></div>` +
            `<div class="mr-bar"><i style="width:${(m.pct / max) * 100}%"></i></div></div>`
        )
        .join("");
      if (c.disclaimer) $("#cohortDisclaimer").textContent = c.disclaimer;
    } catch {}
  })();

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

  function addMsg(role, text, msgMode) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;
    if (role === "assistant" && msgMode) {
      const tag = document.createElement("div");
      tag.className = `msg-tag ${msgMode}`;
      tag.textContent = msgMode === "agent" ? "AI Agent" : "Mentor";
      wrap.appendChild(tag);
    }
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

  // Mentor lane: no AI — queue for the human team + hand back a WhatsApp link.
  async function sendMentor(msg) {
    busy = true; sendBtn.disabled = true;
    input.value = ""; autoGrow();
    welcome.style.display = "none";
    chat.querySelectorAll(".chips.inline").forEach((n) => n.remove());
    addMsg("user", msg);
    try {
      const res = await fetch("/api/mentor-question", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reach the mentor team");
      const { wrap, bubble } = addMsg("assistant", data.ack, "mentor");
      const wa = document.createElement("a");
      wa.className = "wa-btn"; wa.href = data.waLink; wa.target = "_blank"; wa.rel = "noopener";
      wa.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.16L2.05 22l4.97-1.55A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-2.95.92.94-2.87-.2-.3a8.2 8.2 0 1 1 6.7 3.58z"/></svg> Send on WhatsApp';
      bubble.appendChild(wa);
      addActions(wrap, bubble, data.messageId);
    } catch (err) {
      showError(err.message || "Couldn't reach the mentor team — please try again.");
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  async function send(text) {
    const msg = (text ?? input.value).trim();
    if (!msg || busy) return;
    if (mode === "mentor") return sendMentor(msg);
    busy = true; sendBtn.disabled = true;
    input.value = ""; autoGrow();
    welcome.style.display = "none";
    chat.querySelectorAll(".chips.inline").forEach((n) => n.remove());

    addMsg("user", msg);

    const { wrap, bubble } = addMsg("assistant", "", mode);
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
        body: JSON.stringify({ sessionId, message: msg, mode }),
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
          const { wrap, bubble } = addMsg(m.role, m.content, m.mode);
          if (m.role === "assistant") addActions(wrap, bubble, m.id, m.feedback);
        }
      }
    } catch {}
    input.focus();
  })();
})();
