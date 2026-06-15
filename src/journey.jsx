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
  Mail, User, Clock, MapPin, Target, GraduationCap, AlertTriangle,
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
    unlock: "Department chosen → Stage 5",
  },
  {
    n: 5, title: "Product & Offer Training", subtitle: "Know the offer cold", when: "Week 1",
    Icon: Package, kind: "page",
    short: "Master the Accelerator: value, pricing & EMI, who it's for, why it beats bootcamp.",
    detail: "Study the actual offer until you can explain it simply — value, pricing & EMI, who it's for, what sets it apart from the bootcamp, and the common objections. Pricing/EMI ties to the payment gateways.",
    sections: [
      { h: "Know cold", items: ["Why the Accelerator is the main high-ticket offer", "Pricing & value · EMI options", "Who it's for", "Why it beats the bootcamp", "The common objections"] },
      { h: "Payment gateways", items: ["Razorpay", "Pine Labs", "Shopse", "Fibe / Propel", "XP"] },
      { h: "Compliance — hard rule", items: ["Never promise a job", "Never promise a specific salary"] },
    ],
    unlock: "Explain the offer simply → Stage 6",
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
    unlock: "Pass the sales knowledge check → Stage 7",
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
    unlock: "All gates passed → Stage 10",
  },
  {
    n: 10, title: "Shadowing & Live Support", subtitle: "Learn beside a closer", when: "Transition",
    Icon: Headphones, kind: "page",
    short: "A safe ramp to live: listen → observe → co-pilot → supported → independent.",
    detail: "Before solo calls, go through a supported transition that makes onboarding safer and more realistic.",
    sections: [
      { h: "The 5-step ramp", items: ["1 · Listen — recorded senior calls", "2 · Observe — watch live customer handling", "3 · Co-pilot — join calls, senior leads", "4 · Supported live — you lead, senior on standby", "5 · Independent — solo live calls"] },
    ],
    unlock: "Cleared by a senior / manager → Stage 11",
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

export function LoginScreen({ onAuth }) {
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

export function Dashboard({ user, completed, goStage, onLogout }) {
  const doneCount = TRAINABLE.filter((n) => completed.includes(n)).length;
  const total = TRAINABLE.length;
  const pct = Math.round((doneCount / total) * 100);
  const level = levelFor(doneCount);
  const next = STAGES.find((s) => s.n >= 2 && !completed.includes(s.n) && isUnlocked(s.n, completed));
  const firstName = (user?.name || "there").trim().split(/\s+/)[0];
  const statusFor = (n) => {
    if (completed.includes(n)) return "done";
    if (n === 1) return "here";
    if (!isUnlocked(n, completed)) return "locked";
    return next && next.n === n ? "current" : "open";
  };
  const ctaLabel = doneCount === 0 ? "Start Level 1" : doneCount >= total ? "Review journey" : "Continue";

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

      {/* hero */}
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600, marginBottom:8 }}>Your onboarding dashboard</div>
      <h1 style={{ ...serif, fontSize:"clamp(28px,7vw,42px)", fontWeight:600, margin:"0 0 6px", letterSpacing:-0.6 }}>
        Welcome, {firstName}. Let's get you Sales Ready.
      </h1>
      <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,16.5px)", lineHeight:1.55, maxWidth:620, margin:"0 0 18px" }}>
        Your OutSkill sales onboarding runs in 11 self-paced levels — from company foundations to live calls and a continuous improvement loop. Clear each to unlock the next.
      </p>

      {/* 3 instant-answer cards */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:18 }}>
        <QCard icon={<MapPin size={14}/>} q="Where am I?" a="You're in OutSkill onboarding." />
        <QCard icon={<Target size={14}/>} q="What should I do next?" a={next ? `Level ${next.n - 1} · ${next.title}` : "Every level complete 🎉"} />
        <QCard icon={<GraduationCap size={14}/>} q="How do I become Sales Ready?" a="Finish learning → practice mock calls → pass certification." />
      </div>

      {/* progress card */}
      <div style={{ background:"linear-gradient(100deg, rgba(194,238,69,0.12), rgba(194,238,69,0.03))", border:`1px solid rgba(194,238,69,0.32)`, borderRadius:18, padding:"20px 22px", marginBottom:26 }}>
        <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>Rank</div>
            <div style={{ ...serif, fontSize:26, fontWeight:600, color:LIME }}>{level}</div>
          </div>
          <div style={{ width:1, height:38, background:BORDER }} />
          <div>
            <div style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>Completed</div>
            <div style={{ ...serif, fontSize:26, fontWeight:600 }}>{doneCount}<span style={{ fontSize:16, color:MUTE }}> / {total}</span></div>
          </div>
          <button onClick={() => goStage(next ? next.n : 12)} style={{ ...primaryBtn, marginLeft:"auto" }}>
            {ctaLabel} <ArrowRight size={16} style={{ marginLeft:8 }}/>
          </button>
        </div>
        <div style={{ marginTop:16, height:9, borderRadius:30, background:"rgba(0,0,0,0.35)", overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", borderRadius:30, background:`linear-gradient(90deg, ${LIME_DIM}, ${LIME})`, transition:"width .5s ease" }} />
        </div>
        <div style={{ fontSize:11.5, color:MUTE, marginTop:7 }}>{pct}% of training complete</div>
      </div>

      {/* roadmap */}
      <div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:MUTE, fontWeight:600, marginBottom:10 }}>Your journey · 11 levels</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {STAGES.map((s) => <StepRow key={s.n} stage={s} status={statusFor(s.n)} onClick={() => goStage(s.n)} />)}
      </div>

      <MadeBy mt={26} />
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
function Quiz({ questions, onPass }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const allAnswered = questions.every((_, i) => answers[i] != null);
  const pick = (qi, oi) => { setAnswers(a => ({ ...a, [qi]: oi })); setResult(null); };
  const check = () => {
    const correct = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    const passed = correct === questions.length;
    setResult({ correct, total: questions.length, passed });
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
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, marginTop:8 }}>
      <div>
        <div style={{ fontSize:11, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:10 }}>Generalist mastermind — watch in full</div>
        <div style={{ position:"relative", paddingTop:"56.25%", borderRadius:14, overflow:"hidden", border:`1px solid ${BORDER}`, background:"#000" }}>
          <iframe
            src="https://www.youtube.com/embed/videoseries?list=PLP2Og2n6NgEU8aqCP1FACWYJGopnzuvf3"
            title="Generalist Mastermind Recordings"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:0 }}
          />
        </div>
        <div style={{ fontSize:12.5, color:MUTE, marginTop:7 }}>Full playlist — non-technical track. Watch every session.</div>
      </div>
      <div>
        <div style={{ fontSize:11, letterSpacing:1.2, textTransform:"uppercase", color:LIME_DIM, fontWeight:700, marginBottom:10 }}>Engineering mastermind — watch in full</div>
        <a href="https://drive.google.com/drive/folders/1yHbYhfGAguz6CI5zZG-CFUg20tAj-ryH" target="_blank" rel="noopener noreferrer"
          style={{ ...primaryBtn, textDecoration:"none" }}>
          Open Engineering recordings (Google Drive) <ChevronRight size={16} style={{ marginLeft:6 }} />
        </a>
        <div style={{ fontSize:12.5, color:MUTE, marginTop:8 }}>Hosted on Drive (opens in a new tab) — technical / Python track.</div>
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

      {stage.quiz && <Quiz questions={stage.quiz} onPass={() => setQuizPassed(true)} />}

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
