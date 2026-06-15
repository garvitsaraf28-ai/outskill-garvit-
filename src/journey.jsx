// ============================================================================
// Onboarding Journey — the 12-stage spine that turns a Day-1 new joiner into a
// "Sales Ready" rep, then keeps them improving. Content is sourced from the
// OutSkill Training Journey spec (User_Journey.xlsx). This module owns:
//   • Stage 0  — Login / Sign up (auth gate)
//   • Stage 1  — Welcome Dashboard (progress + roadmap)
//   • Stages 2-12 — StagePage (rich content; some embed already-built tools)
// App.jsx wires the wired stages (7 practice, 8/12 progress, 9 cert, 11 live).
// ============================================================================
import React, { useState } from "react";
import {
  LayoutDashboard, Building2, Users, Briefcase, Package, ClipboardList,
  Phone, MessageSquare, Award, Headphones, Radio, RefreshCw,
  Lock, CheckCircle2, ChevronRight, ArrowLeft, ArrowRight, LogOut,
  Mail, User, Clock, MapPin, Target, GraduationCap, AlertTriangle, Sparkles,
} from "lucide-react";

/* ---- palette (kept in sync with App.jsx) ---- */
const LIME = "#c2ee45";
const LIME_DIM = "#9fc23a";
const INK = "#0a0c08";
const PANEL = "rgba(255,255,255,0.035)";
const BORDER = "rgba(255,255,255,0.09)";
const TXT = "#e7eadd";
const MUTE = "#9aa18c";
const serif = { fontFamily: "'Fraunces', Georgia, serif" };
const primaryBtn = { display:"inline-flex", alignItems:"center", justifyContent:"center", background:LIME, color:INK, border:"none", borderRadius:30, padding:"12px 22px", fontSize:15, fontWeight:600 };
const secondaryBtn = { display:"inline-flex", alignItems:"center", background:"transparent", color:TXT, border:`1px solid ${BORDER}`, borderRadius:30, padding:"11px 18px", fontSize:14, fontWeight:500 };

/* ============================================================================
   STAGE DATA — every stage with the real onboarding content + gating note.
   kind: "dashboard" (Stage 1) | "page" (content) | "wired" (embeds a built tool)
   ========================================================================== */
export const STAGES = [
  {
    n: 1, title: "Welcome Dashboard", subtitle: "Your onboarding home base", when: "Day 1",
    Icon: LayoutDashboard, kind: "dashboard",
    short: "Not training yet — just orientation.",
    detail: "Where am I, what should I do today, and how do I become Sales Ready. Progress bar, today's task and the full roadmap so you never feel lost.",
  },
  {
    n: 2, title: "Company Foundations", subtitle: "What OutSkill is & how we win", when: "Day 1",
    Icon: Building2, kind: "page",
    short: "What OutSkill is, the products, the funnel, and the two masterminds.",
    detail: "OutSkill is an edtech company that sells AI courses, and the Accelerator is our main offer. Learn the products, how the TOFU/MOFU/BOFU funnel feeds the Accelerator, and the two free masterminds where we pitch — then pass the funnel quiz.",
    sections: [
      { h: "The products", items: ["Bootcamp — low-ticket entry course (also pitches the Accelerator)", "Accelerator — 14-day, high-ticket · THE main offer you'll sell", "Fellowship & Catalyst — 6-month deep programs"] },
      { h: "The funnel", items: ["TOFU — Mastermind + Bootcamp (audience comes from our marketing campaigns)", "MOFU — the Accelerator", "BOFU — Fellowship + Catalyst", "Accelerator or Fellowship can be joined right after a mastermind", "Catalyst is never direct — Accelerator or Fellowship first"] },
      { h: "The two masterminds (free workshops)", items: ["Generalist — Sat/Sun, for non-technical people", "Engineering — Fri/Sat, for coders (Python / technical)", "~12–14 hrs, free — where we pitch the Bootcamp + Accelerator"] },
    ],
    quiz: [
      { q: "Which program is OutSkill's MAIN high-ticket offer?", options: ["Bootcamp", "Accelerator", "Fellowship", "Catalyst"], answer: 1 },
      { q: "In the funnel, what sits at MOFU (the middle)?", options: ["Mastermind + Bootcamp", "The Accelerator", "Fellowship + Catalyst", "Nothing"], answer: 1 },
      { q: "The Generalist mastermind is mainly for…", options: ["Python / technical folks", "Non-technical business people", "Only managers", "Existing customers"], answer: 1 },
      { q: "What's true about the masterminds?", options: ["Paid, multi-week", "Free (~12–14 hrs), where we pitch Bootcamp + Accelerator", "They replace the Accelerator", "They're 1:1 only"], answer: 1 },
    ],
    unlock: "Pass the funnel quiz to continue",
  },
  {
    n: 3, title: "Mastermind Immersion", subtitle: "Live the learner experience", when: "Days 2–5",
    Icon: Users, kind: "page",
    short: "Watch the recent Generalist + Engineering recordings to learn how we pitch.",
    detail: "Watch the most recent Generalist and Engineering mastermind recordings end to end. This is where you learn HOW we actually pitch the Accelerator and which prospect routes to which track. Both are embedded below — no tab-switching.",
    sections: [
      { h: "Generalist mastermind", items: ["For non-technical people (Sat/Sun)", "See how the Accelerator is framed for them", "Watch the full recording below"] },
      { h: "Engineering mastermind", items: ["For coders — Python / technical (Fri/Sat)", "Spot who routes to the Engineering track", "Watch the full recording below"] },
    ],
    unlock: "Watch both recordings to continue",
  },
  {
    n: 4, title: "Department Overview", subtitle: "How sales fits together", when: "Day 5–6",
    Icon: Briefcase, kind: "page",
    short: "See Sales / Marketing / Operations, then pick the Inside Sales track.",
    detail: "A quick intro to each department, then choose Inside Sales. For Sales you'll see what the team does, the audience, what's sold, your role, and how leads come in.",
    sections: [
      { h: "The departments", items: ["Sales — convert mastermind attendees", "Marketing — runs the campaigns / TOFU", "Operations — keeps it all running"] },
      { h: "Inside Sales — your team", items: ["Audience: mastermind attendees who did NOT pay", "What's sold: the Accelerator", "Your role: discover, pitch, close, follow up", "How leads come in: straight from the masterminds"] },
    ],
    unlock: "Choose Inside Sales to continue",
  },
  {
    n: 5, title: "Product & Offer Training", subtitle: "Know the offer cold", when: "Week 1",
    Icon: Package, kind: "page",
    short: "Master the Accelerator: price, payment routes, who it's for, and why it beats the bootcamp.",
    detail: "Study the offer until you can explain it simply — the price, the payment routes, who it's for (your 9 buyer personas), and what sets it apart from the bootcamp. Compliance: never promise a job or a specific salary.",
    sections: [
      { h: "The offer & price", items: ["The Accelerator is the main high-ticket offer — 14-day, no-code", "India: Rs 94,999 · International: $2,995", "USD-paying but attended the Indian mastermind: $1,199", "Why it beats the bootcamp (depth, projects, support)"] },
      { h: "What they learn (the 14 days)", items: ["Gen-AI fundamentals & prompt engineering (local models: Ollama, MSTY)", "AI clones — video, voice & image", "AI automations with n8n + agentic AI ('your first AI employee')", "MCPs — Claude, Perplexity, build your own server", "Real-time human-like voice agents", "6-hour Build Day → ship an AI MVP, then build & pitch your project"] },
      { h: "Payment routes", items: ["India one-time: Razorpay", "India EMI (credit card): Pine Labs — zero-cost, 3/6/9/12 mo", "India EMI (debit card): Shopse — zero-cost, after eligibility check", "India, no card: Fibe / Propel (NBFC) via Google form", "International: XP — one-time free; installments add 9%"] },
      { h: "Compliance — hard rule", items: ["Never promise a job", "Never promise a specific salary", "Frame outcomes as ranges / learner stories"] },
    ],
    quiz: [
      { q: "How does Indian EMI work for the learner?", options: ["A 9% fee is added", "Zero-cost — OutSkill bears the interest", "Interest charged monthly", "EMI isn't available in India"], answer: 1 },
      { q: "An INTERNATIONAL learner wants installments. What applies?", options: ["Zero-cost EMI", "A 9% convenience fee is added (via XP)", "No installments allowed", "Pay via Pine Labs"], answer: 1 },
      { q: "India, no credit card, fails the Shopse eligibility check — the route is…", options: ["Refuse EMI", "NBFC partners Fibe / Propel via a Google form", "Razorpay only", "Just charge 9%"], answer: 1 },
      { q: "What must you NEVER promise?", options: ["That it's 14 days", "A guaranteed job or a specific salary", "Zero-cost EMI for India", "That it's no-code"], answer: 1 },
    ],
    unlock: "Pass the offer check to continue",
  },
  {
    n: 6, title: "Sales Process Training", subtitle: "The OutSkill call, step by step", when: "Week 1–2",
    Icon: ClipboardList, kind: "page",
    short: "Learn the 8-step call flow, lead qualification and discovery.",
    detail: "The end-to-end OutSkill call: an 8-step flow, plus lead qualification, discovery questions and how to handle people who attended the mastermind but didn't pay.",
    sections: [
      { h: "The 8-step call flow", items: ["1 · Warm intro", "2 · Why they attended the mastermind", "3 · Their goals", "4 · Why they didn't pay", "5 · Address objections", "6 · Pitch the Accelerator", "7 · Ask for commitment", "8 · Follow-up"] },
      { h: "Also covered", items: ["Lead qualification", "Discovery questions", "Handling no-payment users"] },
    ],
    quiz: [
      { q: "Who is the audience for these sales calls?", options: ["Cold leads from ads", "Mastermind attendees who did NOT pay", "Existing Accelerator students", "Random website visitors"], answer: 1 },
      { q: "In the 8-step flow, what comes right after the warm intro?", options: ["Pitch the Accelerator", "Ask why they attended the mastermind", "Ask for payment", "Handle objections"], answer: 1 },
      { q: "Before you pitch, you should first…", options: ["Quote the price", "Understand their goals and why they didn't pay", "Offer a discount", "Send the brochure"], answer: 1 },
      { q: "Best way to handle an objection?", options: ["Repeat the pitch louder", "Empathize, give one specific fact, confirm it landed, then find the real blocker", "Drop the price", "Move on quickly"], answer: 1 },
    ],
    unlock: "Pass the sales knowledge check to continue",
  },
  {
    n: 7, title: "Mock-Call Room", subtitle: "Practice on realistic AI prospects", when: "Week 2+",
    Icon: Phone, kind: "wired", target: "practice",
    short: "Practice vs AI personas across hint-modes and difficulty rounds.",
    detail: "Run live voice mock-calls against realistic AI prospects. Climb 4 hint-modes (Beginner → Senior) across 6 difficulty rounds (Peer → Director). A real senior or manager can replace the AI in the higher rounds.",
    sections: [
      { h: "Hint modes — how much help", items: ["Beginner — script-assisted prompts", "Standard — free-flow, no script", "Advanced — difficult persona, minimal help", "Senior — no hints, real pressure"] },
      { h: "Difficulty rounds — who you face", items: ["1 · Peer (warm)", "2 · Senior (skeptical)", "3 · Utmost senior (overconfident)", "4 · Manager (hidden blockers)", "5 · Management (high pressure)", "6 · Director (hardest objections)"] },
    ],
    unlock: "Pass each level's score to climb",
  },
  {
    n: 8, title: "Feedback Every Call", subtitle: "Score, strengths, fixes", when: "Week 2+",
    Icon: MessageSquare, kind: "wired", target: "progress",
    short: "Instant feedback: what you said vs what you should've, score /100, the next drill.",
    detail: "After every call you get more than good/bad: what went well, what went wrong, missed opportunities, exact better lines ('you said X → say Y'), a score /100 by criteria, and the one skill + persona to practise next.",
    sections: [
      { h: "The rubric · 0–100", items: ["Opening & rapport", "Discovery & listening", "Pitch quality", "Objection handling", "Close & next step", "Confidence & tone", "Compliance"] },
      { h: "Every feedback card shows", items: ["What went well", "What went wrong (with the moment)", "Missed opportunities", "Better lines: you said X → say Y", "Score /100 by criteria", "Next drill: skill + persona"] },
    ],
  },
  {
    n: 9, title: "Certification / Readiness", subtitle: "Prove you're floor-ready", when: "When ready",
    Icon: Award, kind: "wired", target: "cert",
    short: "Pass the readiness gates to unlock live calls.",
    detail: "Prove you're floor-ready. Pass the company quiz, product quiz, pitch test, and a minimum mock-call score (including the Director round). Passing earns the 'Sales Ready' badge, logged for managers.",
    sections: [
      { h: "Readiness gates", items: ["Company knowledge quiz — basics + funnel", "Product knowledge quiz — Accelerator, pricing & EMI", "Sales pitch test — deliver it end to end", "Mock-call score — minimum across the ladder, incl. Director round"] },
    ],
    unlock: "Pass all the gates to become Sales Ready",
  },
  {
    n: 10, title: "Shadowing & Live Support", subtitle: "Learn beside a closer", when: "Transition",
    Icon: Headphones, kind: "page",
    short: "A safe ramp to live: listen → observe → co-pilot → supported → independent.",
    detail: "Before solo calls, go through a supported transition that makes onboarding safer and more realistic.",
    sections: [
      { h: "The 5-step ramp", items: ["1 · Listen — recorded senior calls", "2 · Observe — watch live customer handling", "3 · Co-pilot — join calls, senior leads", "4 · Supported live — you lead, senior on standby", "5 · Independent — solo live calls"] },
    ],
    unlock: "Cleared by a senior or manager to go live",
  },
  {
    n: 11, title: "Live Work Mode", subtitle: "Real calls, real learners", when: "On ground",
    Icon: Radio, kind: "wired", target: "live",
    short: "Assigned leads, follow-ups, scripts, call history, conversion rate, coach feedback.",
    detail: "Your on-ground dashboard: assigned leads, pending follow-ups, call scripts, call history, performance score, conversion rate and coach feedback. Make calls, log outcomes, update status and review recordings.",
    sections: [
      { h: "Your live dashboard", items: ["Assigned leads", "Pending follow-ups", "Call scripts", "Call history & recordings", "Performance score & conversion rate", "Coach feedback"] },
    ],
    unlock: "Ongoing — this is the job",
  },
  {
    n: 12, title: "Improvement Loop", subtitle: "Get a little better every week", when: "Ongoing",
    Icon: RefreshCw, kind: "wired", target: "progress",
    short: "Call → transcript → AI feedback → drill one weak area → repeat → improve.",
    detail: "Close the loop on every real call. The call is transcribed and analysed, AI gives feedback, you drill one weak area in the Mock-Call Room, repeat, your score improves, and your manager sees progress. This is what keeps you sharp long-term.",
    sections: [
      { h: "The loop", items: ["Call happens", "Transcript analysed", "AI gives feedback", "Drill ONE weak area in the Mock-Call Room", "Repeat the mock call", "Score improves — manager sees progress"] },
    ],
    unlock: "Continuous — never really 'done'",
  },
];

/* ---- progress helpers ---- */
export const TRAINABLE = STAGES.filter((s) => s.n >= 2).map((s) => s.n); // [2..12]
export function isUnlocked(n, completed) {
  if (n <= 2) return true;              // dashboard (1) & first stage (2) always open
  return completed.includes(n - 1);     // sequential unlock
}
const LEVELS = [
  "Rookie", "Getting Started", "Foundations", "Foundations",
  "In Training", "In Training", "Sharpening", "Sharpening",
  "Floor-Ready", "Floor-Ready", "Almost Certified", "Sales Ready · Live",
];
export function levelFor(count) { return LEVELS[Math.min(count, LEVELS.length - 1)]; }

/* ============================================================================
   STAGE 0 — Login / Sign up
   ========================================================================== */
const inputStyle = { width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${BORDER}`, borderRadius:11, padding:"12px 14px", color:TXT, fontSize:14.5 };

function AuthField({ label, icon, children }) {
  return (
    <label style={{ display:"block", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:MUTE, marginBottom:6, fontWeight:500 }}>{icon}{label}</div>
      {children}
    </label>
  );
}

/* Local account registry (device-only for now). A backend / Google sign-in and a
   Sheet-or-email sync can replace this once the data destination is confirmed. */
const ACCT_KEY = "sarafai_accounts_v1";
function loadAccounts() { try { return JSON.parse(localStorage.getItem(ACCT_KEY) || "{}"); } catch { return {}; } }
function saveAccounts(a) { try { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); } catch {} }
// Every signup/login event is logged locally and POSTed to our own serverless
// proxy (/api/log), which holds the private Google Sheet URL + secret token in
// server-side env vars — so neither ever appears in the browser or the repo.
function logEvent(payload) {
  const rec = { ts: new Date().toISOString(), userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : ""), ...payload };
  try { const k = "sarafai_events_v1"; const a = JSON.parse(localStorage.getItem(k) || "[]"); a.push(rec); localStorage.setItem(k, JSON.stringify(a)); } catch {}
  try { fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) }); } catch {}
}

export function LoginScreen({ onAuth, onBack, onManager }) {
  const [mode, setMode] = useState("signup"); // signup | login
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const signup = mode === "signup";
  const canSubmit = email.trim() && pw.trim() && (!signup || name.trim());
  const switchMode = (m) => { setMode(m); setError(""); };
  const submit = (e) => {
    if (e) e.preventDefault();
    setError("");
    const em = email.trim().toLowerCase();
    if (!em || !pw.trim() || (signup && !name.trim())) return;
    const accounts = loadAccounts();
    if (signup) {
      // Can't sign up with an email that already has an account → send to Log in.
      if (accounts[em]) { setError("An account with this email already exists — please log in instead."); setMode("login"); return; }
      const acc = { name: name.trim(), email: email.trim(), password: pw, role: "New joiner", createdAt: Date.now() };
      accounts[em] = acc; saveAccounts(accounts);
      logEvent({ event: "signup", name: acc.name, email: acc.email, password: pw });
      onAuth({ name: acc.name, email: acc.email, role: acc.role });
    } else {
      // Can't log in without an account → send to Sign up. Wrong password is rejected.
      const acc = accounts[em];
      if (!acc) { setError("No account found for this email — please sign up first."); setMode("signup"); return; }
      if (acc.password !== pw) { setError("Incorrect password. Please try again."); return; }
      logEvent({ event: "login", name: acc.name, email: acc.email, password: pw });
      onAuth({ name: acc.name, email: acc.email, role: acc.role || "New joiner" });
    }
  };
  return (
    <div className="osf" style={{ minHeight:"82vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:440 }}>
        {onBack && (
          <button onClick={onBack} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5, marginBottom:14 }}>
            <ArrowLeft size={14}/><span style={{ marginLeft:6 }}>Back</span>
          </button>
        )}
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,10px)", gap:4, justifyContent:"center", marginBottom:18 }}>
            {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:10, height:10, borderRadius:"50%", background:d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow:d?`0 0 12px ${LIME}55`:"none" }}/>))}
          </div>
          <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600, marginBottom:10 }}>OutSkill · Sales Onboarding</div>
          <h1 style={{ ...serif, fontSize:"clamp(26px,7vw,34px)", fontWeight:600, margin:"0 0 6px" }}>{signup ? "Create your account" : "Welcome back"}</h1>
          <p style={{ color:MUTE, fontSize:14, margin:0 }}>{signup ? "Start your Day-1 training journey." : "Log in to continue your onboarding."}</p>
        </div>

        <form onSubmit={submit} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:18, padding:"22px" }}>
          <div style={{ display:"flex", background:"rgba(0,0,0,0.3)", borderRadius:30, padding:4, marginBottom:18 }}>
            {[["signup","Sign up"],["login","Log in"]].map(([m,label])=>(
              <button key={m} type="button" onClick={()=>switchMode(m)}
                style={{ flex:1, border:"none", borderRadius:30, padding:"9px 0", fontSize:13, fontWeight:600, background: mode===m ? LIME : "transparent", color: mode===m ? INK : MUTE }}>
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(232,122,107,0.1)", border:"1px solid rgba(232,122,107,0.4)", color:"#e8a99b", borderRadius:11, padding:"10px 13px", fontSize:12.5, marginBottom:14 }}>
              <AlertTriangle size={14} style={{ flexShrink:0 }}/><span>{error}</span>
            </div>
          )}

          {signup && (
            <AuthField label="Full name" icon={<User size={15}/>}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Garvit Saraf" style={inputStyle}/>
            </AuthField>
          )}
          <AuthField label="Company email" icon={<Mail size={15}/>}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@outskill.com" style={inputStyle}/>
          </AuthField>
          <AuthField label="Password" icon={<Lock size={15}/>}>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" style={inputStyle}/>
          </AuthField>

          {signup && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:8, background:"rgba(194,238,69,0.06)", border:`1px solid rgba(194,238,69,0.2)`, borderRadius:11, padding:"11px 13px", marginBottom:16 }}>
              <GraduationCap size={15} color={LIME_DIM} style={{ marginTop:1, flexShrink:0 }}/>
              <div style={{ fontSize:12.5, color:MUTE, lineHeight:1.5 }}>You'll learn <b style={{ color:TXT }}>both</b> the Generalist and Engineering programs during training — nothing to pick here.</div>
            </div>
          )}

          <button type="submit" disabled={!canSubmit} style={{ ...primaryBtn, width:"100%", marginTop:4, opacity: canSubmit?1:0.5, fontSize:15.5, padding:"13px 22px" }}>
            {signup ? "Create account & start" : "Log in"} <ArrowRight size={17} style={{ marginLeft:8 }}/>
          </button>
          <div style={{ fontSize:11.5, color:MUTE, textAlign:"center", marginTop:14, lineHeight:1.5 }}>
            {signup
              ? "Creating your training profile. Already enrolled? Switch to Log in."
              : "Welcome back. New joiner? Switch to Sign up to create your profile."}
          </div>
        </form>
        {onManager && (
          <div style={{ textAlign:"center", marginTop:16 }}>
            <button onClick={onManager} style={{ background:"transparent", border:"none", color:LIME_DIM, fontSize:12.5, fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>Are you a manager? View the team →</button>
          </div>
        )}
        <MadeBy />
      </div>
    </div>
  );
}

/* ============================================================================
   STAGE 1 — Welcome Dashboard
   ========================================================================== */
function BrandMark() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,6px)", gap:3 }}>
        {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:6, height:6, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1px solid ${MUTE}` }} />))}
      </div>
      <div>
        <div style={{ ...serif, fontSize:20, fontWeight:600, lineHeight:1, color:TXT }}>Outskill</div>
        <div style={{ fontSize:10.5, letterSpacing:1.5, textTransform:"uppercase", color:MUTE, marginTop:3 }}>Sales Onboarding</div>
      </div>
    </div>
  );
}

function MadeBy({ mt = 22 }) {
  return (
    <div style={{ display:"flex", justifyContent:"center", marginTop:mt }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:9, background:"rgba(194,238,69,0.07)", border:`1px solid rgba(194,238,69,0.34)`, borderRadius:30, padding:"7px 15px" }}>
        <span style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:MUTE }}>OutSkill · Built by</span>
        <span style={{ ...serif, fontSize:13.5, fontWeight:600, letterSpacing:1, color:LIME }}>GARVIT SARAF</span>
      </div>
    </div>
  );
}

const Chip = ({ children, done }) => (
  <span style={{ fontSize:9.5, letterSpacing:.8, textTransform:"uppercase", fontWeight:700,
    color: done ? LIME : LIME_DIM, background: done ? "rgba(194,238,69,0.14)" : "rgba(194,238,69,0.08)",
    border:`1px solid ${LIME}33`, borderRadius:20, padding:"2px 7px" }}>{children}</span>
);

function QCard({ icon, q, a }) {
  return (
    <div style={{ flex:1, minWidth:200, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, color:LIME_DIM, fontSize:11.5, fontWeight:600, marginBottom:6 }}>{icon}{q}</div>
      <div style={{ fontSize:14, color:TXT, lineHeight:1.45 }}>{a}</div>
    </div>
  );
}

function StepRow({ stage, status, onClick }) {
  const locked = status === "locked";
  const done = status === "done";
  const current = status === "current" || status === "here";
  const Icon = stage.Icon;
  return (
    <button onClick={locked ? undefined : onClick} disabled={locked}
      style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:14,
        background: current ? "rgba(194,238,69,0.06)" : "transparent",
        border:`1px solid ${current ? "rgba(194,238,69,0.4)" : "transparent"}`,
        borderRadius:14, padding:"12px 14px", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1, transition:"all .15s ease" }}
      onMouseEnter={e=>{ if(!locked && !current) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
      onMouseLeave={e=>{ if(!locked && !current) e.currentTarget.style.background="transparent"; }}>
      <div style={{ width:38, height:38, borderRadius:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
        background: done ? "rgba(194,238,69,0.16)" : current ? "rgba(194,238,69,0.12)" : "rgba(255,255,255,0.05)",
        border:`1px solid ${done||current ? LIME+"55" : BORDER}`, color: done||current ? LIME : MUTE }}>
        {locked ? <Lock size={15}/> : done ? <CheckCircle2 size={18}/> : <Icon size={17}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:10.5, letterSpacing:1, textTransform:"uppercase", color: current?LIME_DIM:MUTE, fontWeight:600 }}>{stage.n === 1 ? "Welcome" : `Level ${stage.n - 1}`}</span>
          {status==="here" && <Chip>You're here</Chip>}
          {status==="current" && <Chip>Up next</Chip>}
          {done && <Chip done>Done</Chip>}
        </div>
        <div style={{ ...serif, fontSize:17, fontWeight:600, color: locked?MUTE:TXT, marginTop:1 }}>{stage.title}</div>
        <div style={{ fontSize:12.5, color:MUTE, marginTop:1 }}>{stage.subtitle}</div>
      </div>
      {!locked && <ChevronRight size={18} color={MUTE} style={{ flexShrink:0 }}/>}
    </button>
  );
}

/* ---- dashboard analytics: inline-SVG charts (no chart library) ---- */
const SHORT = (s) => (s || "").split(/[ &,/]/)[0];
const scoreCol = (v) => v >= 80 ? LIME : v >= 60 ? "#e8d24b" : v >= 40 ? "#e8a94b" : "#e87a6b";
const Insight = ({ children, ok, warn }) => (
  <li style={{ display:"flex", alignItems:"flex-start", gap:9, fontSize:13.5, color:TXT, lineHeight:1.45 }}>
    <span style={{ width:7, height:7, borderRadius:"50%", marginTop:6, flexShrink:0, background: ok ? LIME : warn ? "#e8a94b" : LIME_DIM }} />
    <span>{children}</span>
  </li>
);
const EmptyViz = ({ children }) => (
  <div style={{ padding:"24px 12px", textAlign:"center", color:MUTE, fontSize:12.5, lineHeight:1.5, border:`1px dashed ${BORDER}`, borderRadius:12, background:"rgba(255,255,255,0.02)" }}>{children}</div>
);
const Card = ({ title, children, style }) => (
  <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:"16px 18px", ...style }}>
    {title && <div style={{ fontSize:11, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:12 }}>{title}</div>}
    {children}
  </div>
);
function KPI({ label, value, sub, color = TXT }) {
  return (
    <div style={{ flex:1, minWidth:138, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"13px 15px" }}>
      <div style={{ fontSize:10, letterSpacing:1, textTransform:"uppercase", color:MUTE, marginBottom:6 }}>{label}</div>
      <div style={{ ...serif, fontSize:25, fontWeight:600, color, lineHeight:1.05 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:MUTE, marginTop:4 }}>{sub}</div>}
    </div>
  );
}
function Donut({ pct, size = 122, stroke = 12, color = LIME, big, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset .9s ease" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ ...serif, fontSize:size*0.26, fontWeight:600, color:TXT, lineHeight:1 }}>{big}</div>
        {sub && <div style={{ fontSize:10.5, color:MUTE, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}
function Radar({ data, size = 200 }) {
  const cx = size/2, cy = size/2, R = size/2 - 30, n = data.length;
  const ang = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, rad) => [cx + Math.cos(ang(i)) * rad, cy + Math.sin(ang(i)) * rad];
  const ring = (f) => data.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const poly = data.map((d, i) => pt(i, R * (Math.max(0, Math.min(100, d.pct)) / 100)).join(",")).join(" ");
  return (
    <svg width={size} height={size} style={{ overflow:"visible", display:"block", margin:"0 auto" }}>
      {[0.25,0.5,0.75,1].map(f => <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.07)" />)}
      {data.map((_, i) => { const [x,y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" />; })}
      <polygon points={poly} fill="rgba(194,238,69,0.20)" stroke={LIME} strokeWidth={2} />
      {data.map((d, i) => { const [x,y] = pt(i, R + 14); return <text key={i} x={x} y={y} fill={MUTE} fontSize="8.5" textAnchor="middle" dominantBaseline="middle">{SHORT(d.name)}</text>; })}
    </svg>
  );
}
function Spark({ values, h = 50 }) {
  if (!values.length) return null;
  const w = 240, n = values.length;
  const pts = values.map((v, i) => `${(n === 1 ? w/2 : (i/(n-1))*w).toFixed(1)},${(h - (Math.max(0, Math.min(100, v))/100)*h).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={LIME} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// On-demand AI coaching note (reuses the app's /api/chat endpoint).
function CoachNote({ stats }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    setLoading(true); setNote("");
    try {
      const res = await fetch("/api/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({
        system: "You are a sharp, encouraging OutSkill sales coach. Given a trainee's stats, reply in 2-3 sentences (under 55 words): name one specific strength, one specific gap, and one concrete next drill (suggest a persona + difficulty round if useful). No preamble, no bullet points.",
        messages: [{ role:"user", content: stats }],
      })});
      const data = await res.json();
      const txt = (data?.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
      setNote(txt || "Couldn't generate a note right now — try again.");
    } catch { setNote("Couldn't reach the coach right now — try again."); }
    setLoading(false);
  };
  if (note) return <div style={{ fontSize:13.5, color:TXT, lineHeight:1.55, background:"rgba(194,238,69,0.06)", border:`1px solid rgba(194,238,69,0.25)`, borderRadius:12, padding:"12px 14px", marginTop:12 }}>{note}</div>;
  return (
    <button onClick={ask} disabled={loading} style={{ ...secondaryBtn, marginTop:12, padding:"9px 14px", fontSize:13, opacity: loading ? 0.6 : 1 }}>
      <Sparkles size={14}/><span style={{ marginLeft:7 }}>{loading ? "Thinking…" : "Ask my AI coach"}</span>
    </button>
  );
}

export function Dashboard({ user, completed, goStage, onLogout, history = [] }) {
  const [view, setView] = useState("home"); // "home" roadmap vs "report" analytics
  const quizScores = (() => { try { return JSON.parse(localStorage.getItem("sarafai_quiz_v1") || "{}"); } catch { return {}; } })();
  const doneCount = TRAINABLE.filter((n) => completed.includes(n)).length;
  const total = TRAINABLE.length;
  const pct = Math.round((doneCount / total) * 100);
  const level = levelFor(doneCount);
  const next = STAGES.find((s) => s.n >= 2 && !completed.includes(s.n) && isUnlocked(s.n, completed));
  const firstName = (user?.name || "there").trim().split(/\s+/)[0];

  // program knowledge — from the level quiz checks
  const qs = Object.values(quizScores);
  const knowledge = qs.length ? Math.round(qs.reduce((a, q) => a + (q.correct / q.total) * 100, 0) / qs.length) : null;

  // mock-call analytics — from saved scorecards
  const calls = history.filter((h) => typeof h.overall === "number");
  const callAvg = calls.length ? Math.round(calls.reduce((a, h) => a + h.overall, 0) / calls.length) : null;
  const best = calls.length ? Math.max(...calls.map((h) => h.overall)) : null;
  const trend = [...calls].reverse().map((h) => h.overall);
  const skillMap = {};
  calls.forEach((h) => (h.categories || []).forEach((c) => { if (!skillMap[c.name]) skillMap[c.name] = { s:0, n:0 }; skillMap[c.name].s += c.pct; skillMap[c.name].n++; }));
  const skills = Object.entries(skillMap).map(([name, v]) => ({ name, pct: Math.round(v.s / v.n) }));
  const strongest = skills.length ? skills.reduce((a, b) => a.pct >= b.pct ? a : b) : null;
  const weakest = skills.length ? skills.reduce((a, b) => a.pct <= b.pct ? a : b) : null;

  const ready = doneCount >= total && (callAvg || 0) >= 75;
  const readiness = ready ? "Sales Ready" : doneCount === 0 ? "Day one" : doneCount >= 7 ? "Almost there" : doneCount >= 3 ? "On track" : "Getting started";

  const statusFor = (n) => {
    if (completed.includes(n)) return "done";
    if (n === 1) return "here";
    if (!isUnlocked(n, completed)) return "locked";
    return next && next.n === n ? "current" : "open";
  };
  const ctaLabel = doneCount === 0 ? "Start Level 1" : doneCount >= total ? "Review journey" : "Continue";

  // AI-coach stats line
  const statsStr = `Completion ${pct}% (${doneCount}/${total} levels). Program knowledge ${knowledge != null ? knowledge + "%" : "not taken"}. Mock-call avg ${callAvg != null ? callAvg : "none"} (best ${best != null ? best : "-"}, ${calls.length} calls). Strongest ${strongest ? SHORT(strongest.name) + " " + strongest.pct + "%" : "n/a"}. Weakest ${weakest ? SHORT(weakest.name) + " " + weakest.pct + "%" : "n/a"}. Personas: Rajesh, Sandeep, Priya, Meena, Arvind, Vikram, Anjali, Suresh, Salman. Difficulty rounds: Peer..Director.`;

  // next-best-action
  const focus = (weakest && weakest.pct < 70)
    ? { title: `Drill your weakest skill: ${SHORT(weakest.name)} (${weakest.pct}%)`, sub: "Run a mock call and focus on this.", go: () => goStage(7), cta: "Open Mock-Call Room" }
    : next
    ? { title: `Continue Level ${next.n - 1}: ${next.title}`, sub: next.short || "Pick up where you left off.", go: () => goStage(next.n), cta: "Continue" }
    : { title: "Keep your edge — run a fresh mock call", sub: "You're Sales Ready; stay sharp.", go: () => goStage(7), cta: "Open Mock-Call Room" };

  // achievements
  const anyQuizAce = Object.values(quizScores).some((q) => q.total > 0 && q.correct === q.total);
  const badges = [
    { e:"🚀", label:"First Steps", on: completed.includes(2) },
    { e:"🎯", label:"Quiz Ace", on: anyQuizAce },
    { e:"📞", label:"First Call", on: calls.length >= 1 },
    { e:"🔥", label:"Practised ×3", on: calls.length >= 3 },
    { e:"⭐", label:"Halfway", on: doneCount >= 6 },
    { e:"🏆", label:"Sales Ready", on: ready },
  ];

  return (
    <div className="osf">
      {/* top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22, flexWrap:"wrap" }}>
        <BrandMark />
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:600, color:TXT }}>{user?.name || "Trainee"}</div>
            <div style={{ fontSize:11, color:MUTE }}>{user?.email || "New joiner"}</div>
          </div>
          <button onClick={onLogout} title="Log out" style={{ ...secondaryBtn, padding:"8px 12px", fontSize:12.5 }}>
            <LogOut size={14}/><span style={{ marginLeft:6 }}>Log out</span>
          </button>
        </div>
      </div>

      {view === "report" ? (<>
      <button onClick={() => setView("home")} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5, marginBottom:16 }}>
        <ArrowLeft size={14}/><span style={{ marginLeft:6 }}>Back to dashboard</span>
      </button>
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600, marginBottom:8 }}>Your readiness report</div>
      <h1 style={{ ...serif, fontSize:"clamp(24px,6vw,36px)", fontWeight:600, margin:"0 0 16px", letterSpacing:-0.6 }}>
        {firstName}'s analysis snapshot
      </h1>

      {/* KPI row */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <KPI label="Completion" value={`${pct}%`} sub={`${doneCount} of ${total} levels`} color={LIME} />
        <KPI label="Program knowledge" value={knowledge != null ? `${knowledge}%` : "—"} sub={qs.length ? `${qs.length} quiz check${qs.length>1?"s":""}` : "take the quizzes"} color={knowledge != null ? scoreCol(knowledge) : MUTE} />
        <KPI label="Mock-call avg" value={callAvg != null ? callAvg : "—"} sub={calls.length ? `best ${best} · ${calls.length} call${calls.length>1?"s":""}` : "no calls yet"} color={callAvg != null ? scoreCol(callAvg) : MUTE} />
        <KPI label="Rank" value={readiness} sub={level} color={ready ? LIME : TXT} />
      </div>

      {/* today's focus — next best action */}
      <button onClick={focus.go} style={{ width:"100%", textAlign:"left", background:"linear-gradient(100deg, rgba(194,238,69,0.16), rgba(194,238,69,0.04))", border:`1px solid rgba(194,238,69,0.4)`, borderRadius:16, padding:"16px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:"rgba(194,238,69,0.18)", display:"flex", alignItems:"center", justifyContent:"center", color:LIME, flexShrink:0 }}><Target size={20}/></div>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:10.5, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:2 }}>Today's focus</div>
          <div style={{ ...serif, fontSize:17, fontWeight:600 }}>{focus.title}</div>
          <div style={{ fontSize:12.5, color:MUTE, marginTop:1 }}>{focus.sub}</div>
        </div>
        <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:700, color:INK, background:LIME, borderRadius:30, padding:"9px 16px", flexShrink:0 }}>{focus.cta} <ChevronRight size={15}/></span>
      </button>

      {/* progress donut + analysis */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:14 }}>
        <div style={{ background:"linear-gradient(120deg, rgba(194,238,69,0.12), rgba(194,238,69,0.03))", border:`1px solid rgba(194,238,69,0.3)`, borderRadius:16, padding:"18px 20px", display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
          <Donut pct={pct} big={`${pct}%`} sub="complete" />
          <div style={{ flex:1, minWidth:130 }}>
            <div style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>Training progress</div>
            <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:12 }}>{doneCount} / {total} levels</div>
            <button onClick={() => goStage(next ? next.n : 12)} style={primaryBtn}>{ctaLabel} <ArrowRight size={16} style={{ marginLeft:8 }}/></button>
          </div>
        </div>
        <Card title="Your analysis">
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, background: ready ? "rgba(194,238,69,0.14)" : "rgba(255,255,255,0.05)", border:`1px solid ${ready ? LIME+"55" : BORDER}`, borderRadius:30, padding:"5px 12px", fontSize:12.5, fontWeight:600, color: ready ? LIME : TXT, marginBottom:12 }}>
            <Award size={14}/> {readiness}
          </div>
          <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:9 }}>
            <Insight ok={knowledge != null && knowledge >= 70}>{knowledge != null ? `Program knowledge at ${knowledge}% across ${qs.length} quiz check${qs.length>1?"s":""}.` : "Take the level quizzes to build your program-knowledge score."}</Insight>
            <Insight ok={!!strongest}>{strongest ? `Strongest skill: ${SHORT(strongest.name)} (${strongest.pct}%).` : "Run a mock call (Level 6) to chart your selling skills."}</Insight>
            <Insight warn={!!weakest}>{weakest ? `Focus next: ${SHORT(weakest.name)} (${weakest.pct}%).` : "Your weak spots surface after a few calls."}</Insight>
            <Insight ok={!next}>{next ? `Up next: Level ${next.n - 1} · ${next.title}.` : "Every level complete — you're Sales Ready! 🎉"}</Insight>
          </ul>
          <CoachNote stats={statsStr} />
        </Card>
      </div>

      {/* charts: skills radar + score trend */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:24 }}>
        <Card title="Selling skills">
          {skills.length >= 3
            ? <Radar data={skills} />
            : <EmptyViz>Run mock calls (Level 6) to chart your skills across opening, discovery, objection-handling and close.</EmptyViz>}
        </Card>
        <Card title="Mock-call trend">
          {trend.length
            ? (<div>
                <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8 }}>
                  <span style={{ ...serif, fontSize:30, fontWeight:600, color:scoreCol(callAvg) }}>{callAvg}</span>
                  <span style={{ fontSize:12, color:MUTE }}>avg · best {best} · {calls.length} call{calls.length>1?"s":""}</span>
                </div>
                <Spark values={trend} />
              </div>)
            : <EmptyViz>Your scores over time appear here once you've run a mock call.</EmptyViz>}
        </Card>
      </div>

      {/* achievements */}
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:MUTE, fontWeight:600, marginBottom:10 }}>Achievements</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
        {badges.map((b, i) => (
          <div key={i} title={b.on ? "Earned" : "Locked"} style={{ display:"flex", alignItems:"center", gap:7, background: b.on ? "rgba(194,238,69,0.1)" : "rgba(255,255,255,0.03)", border:`1px solid ${b.on ? LIME+"44" : BORDER}`, borderRadius:30, padding:"7px 13px", opacity: b.on ? 1 : 0.45 }}>
            <span style={{ fontSize:15, filter: b.on ? "none" : "grayscale(1)" }}>{b.e}</span>
            <span style={{ fontSize:12.5, fontWeight:600, color: b.on ? TXT : MUTE }}>{b.label}</span>
          </div>
        ))}
      </div>
      </>) : (<>
      {/* home: greeting + actions + roadmap */}
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600, marginBottom:8 }}>Your onboarding dashboard</div>
      <h1 style={{ ...serif, fontSize:"clamp(26px,6.5vw,40px)", fontWeight:600, margin:"0 0 6px", letterSpacing:-0.6 }}>Welcome, {firstName}.</h1>
      <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,16.5px)", lineHeight:1.55, maxWidth:620, margin:"0 0 16px" }}>
        Your onboarding runs in 11 self-paced levels. Open your dashboard for the full analysis &amp; report, or jump back in below.
      </p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:24 }}>
        <button onClick={() => goStage(next ? next.n : 12)} style={primaryBtn}>{ctaLabel} <ArrowRight size={16} style={{ marginLeft:8 }}/></button>
        <button onClick={() => setView("report")} style={secondaryBtn}><LayoutDashboard size={15}/><span style={{ marginLeft:7 }}>My dashboard &amp; report</span></button>
      </div>

      {/* roadmap */}
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:MUTE, fontWeight:600, marginBottom:10 }}>Your journey · 11 levels</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {STAGES.map((s) => <StepRow key={s.n} stage={s} status={statusFor(s.n)} onClick={() => goStage(s.n)} />)}
      </div>
      </>)}

      <MadeBy mt={26} />
    </div>
  );
}

/* ============================================================================
   Manager / Team view — gated leaderboard of every rep's onboarding progress
   ========================================================================== */
export function ManagerView({ onBack }) {
  const [key, setKey] = useState("");
  const [reps, setReps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [configured, setConfigured] = useState(true);
  const load = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/progress?key=${encodeURIComponent(key)}`);
      if (r.status === 403) { setErr("Wrong passcode."); setReps(null); setLoading(false); return; }
      const d = await r.json();
      setConfigured(d.configured !== false);
      setReps((d.reps || []).sort((a, b) => (b.completion - a.completion) || ((b.callAvg || 0) - (a.callAvg || 0))));
    } catch { setErr("Couldn't load team data."); }
    setLoading(false);
  };

  const readyCount = reps ? reps.filter((r) => r.readiness === "Sales Ready").length : 0;
  const avgCompletion = reps && reps.length ? Math.round(reps.reduce((a, r) => a + (r.completion || 0), 0) / reps.length) : 0;
  const weakFreq = {};
  (reps || []).forEach((r) => { if (r.weakSkill) weakFreq[r.weakSkill] = (weakFreq[r.weakSkill] || 0) + 1; });
  const teamWeak = Object.entries(weakFreq).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="osf" style={{ maxWidth:760, margin:"0 auto" }}>
      <button onClick={onBack} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5, marginBottom:16 }}>
        <ArrowLeft size={14}/><span style={{ marginLeft:6 }}>Back</span>
      </button>
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600, marginBottom:8 }}>OutSkill · Sales · Manager view</div>
      <h1 style={{ ...serif, fontSize:"clamp(24px,6vw,36px)", fontWeight:600, margin:"0 0 14px", letterSpacing:-0.6 }}>Team onboarding</h1>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:18 }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Manager passcode (if set)" type="password"
          style={{ flex:1, minWidth:180, background:"rgba(255,255,255,0.04)", border:`1px solid ${BORDER}`, borderRadius:11, padding:"11px 13px", color:TXT, fontSize:14 }} />
        <button onClick={load} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>{loading ? "Loading…" : "View team"}</button>
      </div>
      {err && <div style={{ color:"#e8a99b", fontSize:13, marginBottom:14 }}>{err}</div>}

      {reps && (
        <>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
            <KPI label="Reps" value={reps.length} />
            <KPI label="Sales Ready" value={readyCount} color={LIME} />
            <KPI label="Avg completion" value={`${avgCompletion}%`} />
            <KPI label="Team weak spot" value={teamWeak ? SHORT(teamWeak[0]) : "—"} sub={teamWeak ? `${teamWeak[1]} rep${teamWeak[1] > 1 ? "s" : ""}` : ""} color="#e8a94b" />
          </div>

          {!configured && (
            <div style={{ background:"rgba(232,178,75,0.1)", border:"1px solid rgba(232,178,75,0.4)", borderRadius:12, padding:"12px 14px", fontSize:12.5, color:"#e8c98b", marginBottom:14, lineHeight:1.5 }}>
              No team database connected yet. Add the free <b>Upstash Redis</b> integration in Vercel (Storage → Marketplace) and reps' progress will sync here automatically — no code change needed.
            </div>
          )}

          {reps.length === 0 ? (
            <EmptyViz>No rep data yet. Once reps use the app (with the team database connected), they appear here ranked by completion.</EmptyViz>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {reps.map((r, i) => (
                <div key={r.email || i} style={{ display:"flex", alignItems:"center", gap:12, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"12px 14px", flexWrap:"wrap" }}>
                  <div style={{ ...serif, fontSize:16, fontWeight:600, color:MUTE, width:22, textAlign:"center" }}>{i + 1}</div>
                  <div style={{ flex:1, minWidth:130 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:TXT }}>{r.name || r.email}</div>
                    <div style={{ fontSize:11, color:MUTE }}>{r.email}</div>
                  </div>
                  <div style={{ minWidth:110, flex:1 }}>
                    <div style={{ height:7, borderRadius:30, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                      <div style={{ width:`${r.completion || 0}%`, height:"100%", background:`linear-gradient(90deg, ${LIME_DIM}, ${LIME})`, borderRadius:30 }} />
                    </div>
                    <div style={{ fontSize:10.5, color:MUTE, marginTop:3 }}>{r.completion || 0}% · {r.done || 0}/11 levels</div>
                  </div>
                  <div style={{ textAlign:"right", minWidth:54 }}>
                    <div style={{ ...serif, fontSize:18, fontWeight:600, color: r.callAvg != null ? scoreCol(r.callAvg) : MUTE }}>{r.callAvg != null ? r.callAvg : "—"}</div>
                    <div style={{ fontSize:10, color:MUTE }}>mock avg</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color: r.readiness === "Sales Ready" ? INK : TXT, background: r.readiness === "Sales Ready" ? LIME : "rgba(255,255,255,0.06)", border:`1px solid ${r.readiness === "Sales Ready" ? LIME : BORDER}`, borderRadius:20, padding:"3px 9px" }}>{r.readiness || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <MadeBy mt={24} />
    </div>
  );
}

/* ============================================================================
   STAGES 2-12 — generic StagePage (rich content; App injects wired tools)
   ========================================================================== */
function StageBadge({ n, done, size = 48 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:14, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
      background: done ? "rgba(194,238,69,0.15)" : "rgba(255,255,255,0.05)",
      border:`1px solid ${done ? LIME+"66" : BORDER}`, color: done ? LIME : TXT, ...serif, fontSize:19, fontWeight:600 }}>
      {done ? <CheckCircle2 size={24}/> : n}
    </div>
  );
}

function SectionPanel({ h, items }) {
  return (
    <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px 18px" }}>
      <div style={{ fontSize:11, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:11 }}>{h}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:LIME_DIM, marginTop:6, flexShrink:0 }} />
            <span style={{ fontSize:14, color:TXT, lineHeight:1.45 }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable quiz gate. Pass = every question correct; calls onPass when cleared.
function Quiz({ questions, onPass, quizKey }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const allAnswered = questions.every((_, i) => answers[i] != null);
  const pick = (qi, oi) => { setAnswers(a => ({ ...a, [qi]: oi })); setResult(null); };
  const check = () => {
    const correct = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    const passed = correct === questions.length;
    setResult({ correct, total: questions.length, passed });
    if (quizKey != null) {
      try {
        const k = "sarafai_quiz_v1";
        const all = JSON.parse(localStorage.getItem(k) || "{}");
        const prev = all[quizKey];
        if (!prev || correct >= prev.correct) all[quizKey] = { correct, total: questions.length, ts: Date.now() };
        localStorage.setItem(k, JSON.stringify(all));
      } catch {}
    }
    if (passed && onPass) onPass();
  };
  return (
    <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:"20px", marginTop:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <CheckCircle2 size={16} color={LIME_DIM} />
        <div style={{ ...serif, fontSize:18, fontWeight:600 }}>Quick check</div>
      </div>
      <div style={{ fontSize:13, color:MUTE, marginBottom:16 }}>Answer all questions correctly to unlock the next level.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
        {questions.map((q, qi) => (
          <div key={qi}>
            <div style={{ fontSize:14.5, fontWeight:600, color:TXT, marginBottom:9 }}>{qi + 1}. {q.q}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const showCorrect = result && oi === q.answer;
                const showWrong = result && selected && oi !== q.answer;
                let bg = "rgba(255,255,255,0.03)", bc = BORDER, col = TXT;
                if (showCorrect) { bg = "rgba(194,238,69,0.12)"; bc = LIME + "66"; col = LIME; }
                else if (showWrong) { bg = "rgba(232,122,107,0.1)"; bc = "rgba(232,122,107,0.5)"; col = "#e8a99b"; }
                else if (selected) { bg = "rgba(194,238,69,0.08)"; bc = LIME + "44"; }
                return (
                  <button key={oi} type="button" onClick={() => pick(qi, oi)}
                    style={{ textAlign:"left", padding:"10px 13px", borderRadius:10, background:bg, border:`1px solid ${bc}`, color:col, fontSize:13.5 }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {result && (
        <div style={{ marginTop:16, fontSize:13.5, fontWeight:600, color: result.passed ? LIME : "#e8a99b" }}>
          {result.passed ? "✓ Passed — you can continue below." : `${result.correct}/${result.total} correct — fix the highlighted ones and check again.`}
        </div>
      )}
      {!(result && result.passed) && (
        <button type="button" onClick={check} disabled={!allAnswered}
          style={{ ...primaryBtn, marginTop:14, opacity: allAnswered ? 1 : 0.5 }}>
          Check answers
        </button>
      )}
    </div>
  );
}

// Mastermind recordings embedded in-portal (Level 2). Generalist = YouTube
// playlist (plays inline); Engineering = Google Drive folder (opens in a tab).
export function MastermindRecordings() {
  const GEN = ["VDnFr_hx5N0", "GYBdgKZlKaA"]; // Generalist mastermind (YouTube)
  const ENG = [                                // Engineering mastermind (Google Drive video files)
    "1nagIgLAy21WDxYiUIshm9H7oYd9V0WJF",
    "1VxyKz_dzpERToySg4g_RQV-KdI8a86TC",
    "1awA_ier_xASpEAEvlmlRPzZQmMrNnDhT",
    "1lshsoYccafTas6u_YXDaAU_QqiBgQ3Yj",
  ];
  const labelStyle = { fontSize:11, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:10 };
  const Frame = ({ src, title }) => (
    <div style={{ position:"relative", paddingTop:"56.25%", borderRadius:14, overflow:"hidden", border:`1px solid ${BORDER}`, background:"#000", marginBottom:12 }}>
      <iframe src={src} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:0 }} />
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22, marginTop:8 }}>
      <div>
        <div style={labelStyle}>Generalist mastermind — watch in full</div>
        {GEN.map((id, i) => <Frame key={id} src={`https://www.youtube.com/embed/${id}`} title={`Generalist Mastermind — session ${i + 1}`} />)}
        <div style={{ fontSize:12.5, color:MUTE }}>Non-technical track. Watch both sessions.</div>
      </div>
      <div>
        <div style={labelStyle}>Engineering mastermind — watch in full</div>
        {ENG.map((id, i) => <Frame key={id} src={`https://drive.google.com/file/d/${id}/preview`} title={`Engineering Mastermind — session ${i + 1}`} />)}
        <div style={{ fontSize:12.5, color:MUTE }}>Technical / Python track. Plays here from Drive (the files must be shared "anyone with the link").</div>
      </div>
    </div>
  );
}

export function StagePage({ stage, isDone, onComplete, goDashboard, children }) {
  const sections = stage.sections || [];
  const [quizPassed, setQuizPassed] = useState(false);
  const canComplete = isDone || !stage.quiz || quizPassed;
  return (
    <div className="osf">
      <button onClick={goDashboard} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5, marginBottom:18 }}>
        <ArrowLeft size={14}/><span style={{ marginLeft:6 }}>Dashboard</span>
      </button>

      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
        <StageBadge n={stage.n - 1} done={isDone} />
        <div>
          <div style={{ fontSize:11.5, letterSpacing:1.3, textTransform:"uppercase", color:LIME_DIM, fontWeight:600 }}>Level {stage.n - 1} · {stage.subtitle}</div>
          <h1 style={{ ...serif, fontSize:"clamp(25px,6vw,38px)", fontWeight:600, margin:"3px 0 0", letterSpacing:-0.5 }}>{stage.title}</h1>
        </div>
      </div>

      {stage.short && <div style={{ fontSize:"clamp(15px,4vw,18px)", color:TXT, fontWeight:500, lineHeight:1.5, margin:"0 0 8px" }}>{stage.short}</div>}
      {stage.detail && <p style={{ color:MUTE, fontSize:14.5, lineHeight:1.6, maxWidth:680, margin:"0 0 22px" }}>{stage.detail}</p>}

      {sections.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(248px,1fr))", gap:12, marginBottom: children ? 22 : 0 }}>
          {sections.map((sec, i) => <SectionPanel key={i} h={sec.h} items={sec.items} />)}
        </div>
      )}

      {children}

      {stage.quiz && <Quiz questions={stage.quiz} quizKey={stage.n} onPass={() => setQuizPassed(true)} />}

      {stage.unlock && (
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginTop:22, background:"rgba(194,238,69,0.06)", border:`1px solid rgba(194,238,69,0.22)`, borderRadius:30, padding:"8px 15px", fontSize:12.5, color:LIME_DIM, fontWeight:600 }}>
          <Target size={14}/> Unlocks next: {stage.unlock}
        </div>
      )}

      <div style={{ display:"flex", gap:12, marginTop:22, flexWrap:"wrap", alignItems:"center" }}>
        <button onClick={canComplete ? onComplete : undefined} disabled={!canComplete}
          style={{ ...primaryBtn, opacity: canComplete ? 1 : 0.45, cursor: canComplete ? "pointer" : "not-allowed" }}>
          {isDone ? "Completed — continue" : "Mark complete & continue"} <ArrowRight size={16} style={{ marginLeft:8 }}/>
        </button>
        {!canComplete && <span style={{ fontSize:12.5, color:MUTE }}>Pass the quick check above to continue.</span>}
        {isDone && <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:LIME }}><CheckCircle2 size={16}/> Level complete</span>}
      </div>
    </div>
  );
}
