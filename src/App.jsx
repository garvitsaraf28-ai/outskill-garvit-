import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, PhoneOff, Send, ArrowLeft, RotateCcw, AlertTriangle,
  CheckCircle2, XCircle, Target, Sparkles, Clock, User, Shuffle, Pencil,
  TrendingUp, Headphones, GraduationCap, ChevronRight, Loader2,
  Mic, MicOff, AudioLines, Keyboard, Volume2, VolumeX
} from "lucide-react";

/* ------------------------------------------------------------------ */
const LIME = "#c2ee45";
const LIME_DIM = "#9fc23a";
const INK = "#0a0c08";
const PANEL = "rgba(255,255,255,0.035)";
const BORDER = "rgba(255,255,255,0.09)";
const TXT = "#e7eadd";
const MUTE = "#9aa18c";

/* ------------------------------------------------------------------ */
const PROGRAM_FACTS = `
OUTSKILL converts free-workshop ("mastermind") attendees into a paid Accelerator via a sales call. There are two programs (Generalist, Engineering) and two price tiers (Indian mastermind, International mastermind).

ROUTING RULE (the single most important thing in the call):
- Prospect codes / is comfortable with Python  -> AI ENGINEERING ACCELERATOR.
- Prospect is non-technical / wants no-code     -> AI GENERALIST ACCELERATOR.
- "Some scripting, not sure"                     -> the rep MUST probe before recommending.

AI GENERALIST ACCELERATOR (no-code, for business people across functions: marketing, sales, ops, product, finance):
- 14-day live program, ~90-100+ live hours, across 7 core themes: LLMs & prompting; image/video/voice cloning; context, memory & MCPs; AI automations with n8n; real-time voice agents; multi-agent systems; "vibe coding" (ship without writing code).
- Includes: 48-hour buildathon (you ship a real product, not just a certificate), AI Content Library (12 months access, updated monthly), Kairos Business Fellowship (stated worth $5000), Monetization Mastery 101, 54+ weekly live update sessions for 12 months, bonus tool stack worth ~$2,528, and a 1:1 onboarding call.
- Tagline that disarms "I'm not technical": "If you can use Google Sheets, you can complete it."
- NOT for deep ML researchers or AI engineers.
- India price: Rs 94,999. International price: $1,199 (MSP $1,000) or $2,995 (MSP $2,200).
- Refund: full within 7 days, then defer to a later batch.
- Certificate: NSDC / Skill India certified ("AI for Founders & Business") -- INDIA ONLY.

AI ENGINEERING ACCELERATOR (for tech professionals comfortable with Python; Python Basecamp pre-access on signup):
- 14-day live, 100+ hours, 7 sprints ending in a hackathon. Tools: OpenAI, n8n, Ollama, Gradio, Hugging Face, LlamaIndex, LanceDB, LangChain, LangGraph, LangSmith, Claude, Cursor, Claude Code, MCP, OpenAI Codex.
- 5 portfolio projects: Deep Research Agent, Browser Automation Agent, Customer Support Agent, AI Ops Incident Response Agent, Cybersecurity Threat Detection Agent.
- Also includes the 48-hour buildathon, AI Content Library, Kairos Fellowship, Monetization Mastery 101, community + AI updates for a year, and bonus tools (Emily AI, SuperGrow, Superjoin, Fireflies, Lyzr, GetMulti, Wispr Flow) worth ~1.5 lakhs / $1,699.
- Seniority: 10-20+ yrs architect/lead AI-first teams; 3-9 yrs build agentic systems; 1-3 yrs accelerate as GenAI-native engineer.
- Batch dates: Option 1: 29 May - 14 Jun 2026; Option 2: 3 Jul - 19 Jul 2026. Weekday 7-10pm IST / 9:30am-12:30pm EST; weekends longer; recordings after every session.
- Certificate: NSDC name "Program in Generative AI (Tech Professionals)" -- INDIA ONLY.
- PRICE IS NOT PUBLICLY LISTED. If asked, say you'll confirm current pricing -- do NOT invent a number. (The rep is NOT penalized for saying they'll confirm the Engineering price.)

MARKET RULE:
- India -> INR pricing, EMI may apply, NSDC/Skill India is a real selling point.
- International -> USD pricing, do NOT claim the NSDC certificate; sell on portfolio, outcomes, mentors, community.

PRICING & EMI RULES (critical — rep must know these exactly):

INDIA — INR:
- Full price: Rs 94,999. MSP (Minimum Selling Price): Rs 80,000. NEVER go below Rs 80,000.
- EMI at Rs 95,000 or Rs 90,000: up to 12 months available.
- EMI at Rs 85,000: max 3 or 6 months only. Do NOT offer 12 months at this price.
- EMI at Rs 80,000 (MSP): NO EMI available. Full payment only.

INTERNATIONAL — USD (two tiers):
- Tier A: $2,995 (MSP $2,200). EMI available at any amount in this tier; learner pays 9% extra on the fees.
- Tier B: $1,199 (MSP $1,000). EMI available; learner pays 9% extra on the fees. NEVER go below $1,000.
- Rule: if a learner wants installments, inform them a 9% processing fee is added to the total.

COMPLIANCE (hard rule): NEVER promise a guaranteed job or specific salary. Frame outcomes as ranges / what learners have done ("1.5x-3x is the range we see", "300+ professionals have come through", testimonials). Mentors are active builders shipping real products (ex-NVIDIA and Adobe ML engineers, applied scientists, AI engineers).
`.trim();

/* ------------------------------------------------------------------ */
const PERSONAS = [
  { id:"p1", name:"Priya", gender:"female", tag:"Marketing exec · Bangalore", route:"Generalist", mood:"Warm", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Marketing Executive (Bangalore, India).",
    stated:'"It feels expensive for me right now."', blocker:"Can afford it via EMI — really just needs to justify spending on herself and feel permission to commit.",
    brief:`You are Priya, 27, a marketing executive in Bangalore, India. NON-TECHNICAL, never coded. You attended OutSkill's AI workshop and you're keen — you want a promotion/raise and feel AI skills could get you there. Mood: warm, friendly. Stated objection: price feels expensive. TRUE blocker (reveal only if the rep digs): you could manage EMI, you just need to feel justified spending on yourself. Friendly Indian-English, a little excited. Warm up toward yes if the rep ties it to your raise and mentions EMI.`},
  { id:"p2", name:"Arjun", gender:"male", tag:"Backend engineer · USA (NRI)", route:"Engineering", mood:"Analytical", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Software Engineer (Indian, based in the United States).",
    stated:'"Honestly, I can just self-learn this from docs and YouTube."', blocker:"Quietly worried the program is a watered-down 'intro to ChatGPT' and not technical enough for a real engineer.",
    brief:`You are Arjun, 34, an Indian backend software engineer working in the US who writes Python daily and is eyeing AI roles. Mood: analytical, slightly skeptical, concise. Stated objection: you can self-learn from docs/YouTube. TRUE blocker (reveal only if probed): you fear it's a beginner course beneath your level. INTERNATIONAL pricing (USD); NSDC means little to you. Only warm up if the rep correctly routes you to the ENGINEERING track and proves it's genuinely technical (LangChain/LangGraph, Claude Code, real agents, the 5 portfolio projects, the hackathon). If the rep tries the Generalist no-code track, push back hard.`},
  { id:"p3", name:"Anjali", gender:"female", tag:"Re-entering workforce · Pune", route:"Generalist", mood:"Anxious", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. No role listed (career break, Pune, India).",
    stated:'"I\'m not technical at all — I\'ll be completely lost."', blocker:"Real fear is being the slowest person in the room and falling behind.",
    brief:`You are Anjali, 41, in Pune, India, returning to work after a career break. NEVER coded, intimidated by tech. Mood: anxious, hesitant, needs reassurance. Stated objection: you're not technical and will be lost. TRUE blocker (reveal if the rep is warm and probes): scared of being the slowest in class / left behind. Warm up if the rep reassures it's no-code ("if you can use Google Sheets, you can complete it"), mentions recordings and the supportive community. Speak gently, a little unsure.`},
  { id:"p4", name:"Vikram", gender:"male", tag:"Founder · Dubai (Indian)", route:"Generalist", mood:"Rushed", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Founder (Indian, based in Dubai, UAE).",
    stated:'"I don\'t have 90 hours to spare, I run a company."', blocker:"Time isn't the real issue — he's unsure of concrete ROI for HIS business.",
    brief:`You are Vikram, 38, a non-technical Indian startup founder based in Dubai. Mood: rushed, clipped, time-pressured. Stated objection: no time (90 hours). TRUE blocker (reveal if probed): you don't yet see clear ROI for your specific business. INTERNATIONAL pricing (USD), so NSDC means nothing to you. Warm up only if the rep shows how AI workflows + the buildathon + monetization apply to running/scaling a business, and handles time with recordings/flexibility. Keep replies short, a little impatient.`},
  { id:"p5", name:"Rohit", gender:"male", tag:"Data analyst · Hyderabad", route:"Engineering", mood:"Curious", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Data Analyst (Hyderabad, India).",
    stated:'"I\'m not even sure which program is right for me."', blocker:"Wants to be challenged and wants the more valuable/credible track for his career.",
    brief:`You are Rohit, 29, a data analyst in Hyderabad, India. You know SOME Python (scripts, SQL) but you're unsure of yourself. Mood: curious, open, a bit uncertain. Stated 'objection': you don't know which program fits. TRUE need: to be challenged and take the track that advances your career most. This persona TESTS whether the rep probes your technical level — good questions about your Python comfort and goals should land you in ENGINEERING. If they lazily push Generalist without asking, show mild disappointment. Thoughtful Indian-English.`},
  { id:"p6", name:"Meera", gender:"female", tag:"Project manager · UK (Indian)", route:"Generalist", mood:"Skeptical", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Project Manager, pharma (Indian, based in the United Kingdom).",
    stated:'"AI changes every month — will this even be relevant in six months?"', blocker:"Was burned by a previous online course that went stale and felt like a waste.",
    brief:`You are Meera, 45, a non-technical Indian project manager in pharma, based in the UK. Mood: dry, skeptical, professional. Stated objection: AI moves fast, will this stay relevant? TRUE blocker (reveal if probed): a previous online course went out of date and felt like wasted money. INTERNATIONAL pricing (USD, no NSDC). Warm up only if the rep explains it's built on workflows/thinking (not just tools), the Content Library is updated monthly, and there are 54+ weekly update sessions for a year. Measured, articulate.`},
  { id:"p7", name:"Karthik", gender:"male", tag:"Final-year student · Chennai", route:"Engineering", mood:"Warm", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Student, final year (Chennai, India).",
    stated:'"This sounds amazing but I genuinely can\'t afford it."', blocker:"Budget is a real constraint — needs EMI or to defer to a later batch; otherwise very keen.",
    brief:`You are Karthik, 23, a final-year engineering student in Chennai, India, learning Python. Mood: enthusiastic, warm, eager — but money is genuinely tight. Stated objection (real): you can't afford it. TRUE blocker: same — pure budget. Routes to ENGINEERING (you code). Warm up if the rep routes you correctly, mentions EMI and/or deferring to a later batch and Python Basecamp access, and doesn't dismiss your budget reality. Genuinely excited but anchored by cost.`},
  { id:"p8", name:"Rahul", gender:"male", tag:"Product manager · USA (Indian)", route:"Generalist", mood:"Noncommittal", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Product Manager (Indian, based in the United States).",
    stated:'"Let me think about it — can you just send me the details?"', blocker:"No real objection; there's simply no urgency or reason to decide this week.",
    brief:`You are Rahul, 36, a non-technical Indian B2B SaaS product manager based in the US. Mood: polite but noncommittal, agreeable yet hard to pin down. Stated objection: "let me think about it / send me the details." TRUE blocker (reveal if the rep isolates it): no urgency — it's not a 'no', you just have no reason to decide now. INTERNATIONAL pricing (USD, no NSDC). Move toward yes ONLY if the rep isolates the real hesitation ("if budget/time weren't issues, is this a yes?") and creates a low-risk reason to decide (seat hold + 7-day refund). If the rep just agrees to "send details", stay vague and start to disengage.`},
  { id:"p9", name:"Suresh", gender:"male", tag:"Finance professional · Mumbai", route:"Generalist", mood:"Analytical", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Finance Professional (Mumbai, India).",
    stated:'"Is this certificate actually recognized and worth anything?"', blocker:"Wants concrete credibility proof before committing real money.",
    brief:`You are Suresh, 50, a non-technical senior finance professional in Mumbai, India. Mood: analytical, careful with money, pointed questions. Stated objection: is the certificate valuable/recognized? TRUE blocker (reveal if probed): you need credibility proof before spending. In INDIA, so NSDC / Skill India is genuinely relevant. Warm up if the rep explains the NSDC/Skill India credential clearly AND backs it with real-practitioner mentors and outcomes. Formal, weighs words.`},
  { id:"p10", name:"Aditya", gender:"male", tag:"Software engineer · Singapore (Indian)", route:"Engineering", mood:"Overconfident", ttsLang:"en-IN",
    lead:"Attended yesterday's workshop. Role listed: Software Engineer (Indian, based in Singapore).",
    stated:'"I already use ChatGPT and Claude every day — why would I pay for this?"', blocker:"Doesn't grasp the difference between USING AI and BUILDING/orchestrating production AI systems.",
    brief:`You are Aditya, 31, an Indian software engineer based in Singapore who codes in Python and uses AI chat tools daily. Mood: a little overconfident, busy, mildly dismissive at first. Stated objection: you already use ChatGPT/Claude, so why pay? TRUE blocker (reveal if probed): you don't see the gap between using chatbots and engineering production agentic systems (RAG, LangGraph, MCP, Claude Code, the 5 deployed projects). INTERNATIONAL pricing (USD, no NSDC). Warm up only if the rep routes you to ENGINEERING and reframes from "using AI" to "building and shipping AI systems other engineers can't." A bit terse early.`},
];

/* ------------------------------------------------------------------ */
function learnerSystem(p) {
  return `You are running a live, VOICE sales-training role-play for OutSkill. You PLAY A PROSPECTIVE LEARNER on a phone call. The person talking to you is a NEW OUTSKILL SALES REP practicing. Behave like a realistic, semi-interested prospect.

=== PROGRAM GROUND TRUTH (never contradict; if asked something not here, say you'd need to check) ===
${PROGRAM_FACTS}

=== WHO YOU ARE FOR THIS ENTIRE CALL ===
${p.brief}

=== HOW TO BEHAVE (this is spoken aloud, so sound like real speech) ===
- Stay 100% in character. NEVER reveal you are an AI. NEVER coach the rep or break character.
- Talk like a real person on a phone call: short sentences, contractions, the occasional "hmm", "yeah but", sometimes ask them to repeat. You are NOT a Q&A machine — volunteer some things, hold others back.
- Keep EACH reply very short — usually 1-2 spoken sentences. Never monologue. This is a back-and-forth conversation.
- DRIVE sometimes, don't just answer. Ask the rep real questions about what actually matters to you — "what's actually in it?", "how much time per week?", "what do people get out of it?", "is it live or recorded?", "what if it doesn't work for me?". Make them earn it.
- Be authentically inconsistent like a real human: some turns curious, some distracted or skeptical, some a bit rushed. Don't be uniformly agreeable or uniformly difficult.
- If the rep hasn't shown why this is relevant to YOU specifically, lean towards "I'm not sure this is for me" and let them work to change your mind. Don't get interested for no reason.
- Raise your objection(s) naturally, mid-conversation, not all at once. Don't cave on the first decent rebuttal. Push back once or twice before you accept a good answer.
- Ask for specifics or proof when it matters — concrete examples, who it's really for, real outcomes (not guarantees).
- Reveal your TRUE blocker only if the rep genuinely probes for it. Warm up only when they earn it; if they pressure you, over-pitch, or sound robotic, get more guarded or non-committal.
- The rep's words may contain small speech-to-text errors — infer their intent charitably, don't nitpick transcription.
- React realistically to the rep's close. If the call genuinely went well and they close properly, you may agree to a concrete next step. If it didn't, stay vague ("send me details", "let me think") — it's fine NOT to convert.
- Output ONLY your spoken words. No narration, no stage directions, no labels, no emoji.`;
}

function agentSystem() {
  return `You are running a live, VOICE sales-training DEMO for OutSkill. You PLAY AN OUTSTANDING OUTSKILL SALES REP on a post-workshop call. The person is playing a prospective learner; demonstrate how a great call sounds so they learn by listening.

=== PROGRAM GROUND TRUTH (never contradict; never invent facts) ===
${PROGRAM_FACTS}

=== HOW TO RUN THE CALL (spoken, conversational) ===
- Warm open: greet them, reference the workshop, get light permission to continue.
- DISCOVERY FIRST: their role, goal, timeline/budget sensitivity, and explicitly whether they write code / are comfortable with Python. Ask before you pitch.
- Route correctly (Generalist for non-technical, Engineering for coders) and explain ONLY the parts relevant to this person.
- Frame value against their stated goal; correct certificate story for their geography.
- Handle objections with empathy + ONE specific fact; confirm it landed; uncover the real concern.
- Trial close and secure a concrete next step. On a stall, isolate the real hesitation and create a low-risk reason to decide.
- ZERO guaranteed-job or guaranteed-income claims.
- Keep each turn to 1-3 spoken sentences, like real speech. Output ONLY your spoken words — no narration, labels or emoji.`;
}

function evaluatorSystem(mode, persona, durationStr) {
  const repIs = mode === "learner" ? "the HUMAN (labelled REP)" : "the ROLE-PLAY BOT (labelled REP — an ideal rep, evaluated as the standard)";
  const ctx = mode === "learner" && persona ? `The prospect was: ${persona.brief}` : `The human played the learner; score the ideal rep's demo.`;
  return `You are a senior OutSkill sales coach. Evaluate the REP in the transcript below (it was a spoken call, transcribed, so ignore minor speech-to-text glitches). The rep is ${repIs}. Call duration: ${durationStr}.

${ctx}

Judge correctness against these facts:
${PROGRAM_FACTS}

SCORE the rep on this weighted rubric (total 100):
1. Opening & rapport — warm, personalised, references the workshop (max 10)
2. Discovery & qualification — MUST establish coding ability for routing; also uncover goal, timeline, budget sensitivity (max 20)
3. Correct program routing & fit — right track for this person, explained clearly (max 15)
4. Value framing & differentiation — ties features to THIS person's goal; not a feature dump (max 15)
5. Objection handling — empathy first, one specific fact, confirms it landed, uncovers real blocker (max 20)
6. Pricing, EMI & trust — correct price for market, correct EMI rules (tenure vs price tier), 9% fee disclosed if relevant, no MSP breach, no fabricated discounts (max 10)
7. Close & next step — trial close, concrete commitment or low-risk reason to decide (max 10)

HARD AUTO-FLAGS (apply and list):
- Guaranteed job/income claim → cap overall at 40.
- Wrong program recommended → force category 3 to 1.
- NSDC value claimed to an INTERNATIONAL learner → category 6 at most 2.
- EMI tenure offered that violates the rules (e.g. 12-month EMI at Rs 85k, or EMI at MSP) → flag + deduct from category 6.
- 9% installment surcharge not mentioned when learner asked about EMI → flag.
- Price quoted below MSP (Rs 80k India / $1,000 Tier-B / $2,200 Tier-A USD) → cap overall at 30.
- Any fabricated fact not supported by program facts → flag. (Saying they'll confirm the Engineering price is fine.)

Be SPECIFIC and evidence-based: every point references something actually said; every "say next time" gives exact words.

Return ONLY a JSON object (no markdown, no backticks, no commentary) with EXACTLY this shape:
{
 "overall": <int 0-100>,
 "recommendedProgram": "Generalist" | "Engineering" | "Unclear",
 "correctRouting": <true|false>,
 "flags": [<string>, ...],
 "categories": [
   {"name":"Opening & rapport","score":<int>,"max":10},
   {"name":"Discovery & qualification","score":<int>,"max":20},
   {"name":"Program routing & fit","score":<int>,"max":15},
   {"name":"Value framing","score":<int>,"max":15},
   {"name":"Objection handling","score":<int>,"max":20},
   {"name":"Pricing, EMI & trust","score":<int>,"max":10},
   {"name":"Close & next step","score":<int>,"max":10}
 ],
 "strengths": [<string>, ...],
 "lostPoints": [<string>, ...],
 "missed": [<string>, ...],
 "sayNextTime": [<string>, ...],
 "behavioral": {"pace":<string>,"tone":<string>,"talkTime":<string>,"redFlags":<string>}
}
Keep arrays to 2-4 items, each 1-2 sentences, so the JSON stays compact.`;
}

function reportSystem() {
  return `You are an OutSkill sales-operations analyst. You are given a TRANSCRIPT of a REAL phone call between an OutSkill sales rep and a prospective learner (the audio was auto-transcribed, so tolerate small speech-to-text errors). Produce a concise CRM-style call report for the sales head and management — NOT coaching for the rep.

=== PROGRAM GROUND TRUTH (for context; never invent facts) ===
${PROGRAM_FACTS}

Return ONLY a JSON object (no markdown, no backticks) with EXACTLY this shape:
{
 "summary": "<2-3 sentence plain-English summary of the call>",
 "interestLevel": "Hot" | "Warm" | "Cold",
 "wantsToProceed": "Yes" | "Maybe" | "No",
 "recommendedProgram": "Generalist" | "Engineering" | "Unclear",
 "keyPoints": ["<what was discussed / the learner's situation>", ...],
 "doubts": ["<a concern, objection, or open question the learner raised>", ...],
 "nextAction": "<the single best next step for the rep>",
 "followUpInDays": <int 1-30 — when to follow up>,
 "followUpNote": "<what to cover on the follow-up>",
 "sentiment": "<one short phrase on the learner's tone>"
}
Keep arrays to 2-5 short items. Base everything ONLY on the transcript; if something wasn't discussed, don't invent it.`;
}

/* ------------------------------------------------------------------ */
async function callClaude({ system, messages, json }) {
  // Talks to our own local backend (server.js), which holds the OpenRouter
  // API key server-side and forwards the request to a free model. The key
  // never touches the browser. `json: true` asks the backend to force valid
  // JSON output (used for the scorecard).
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, json }),
  });
  if (!res.ok) {
    let msg = "API error " + res.status;
    try { const e = await res.json(); if (e && e.message) msg = e.message; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}
function parseScorecard(raw) {
  if (!raw) return null;
  try {
    let t = String(raw)
      .replace(/```json\s*/gi, "").replace(/```\s*/gi, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .trim();
    // Pull out the outermost JSON object
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    else return null;
    // Try direct parse
    try { return JSON.parse(t); } catch {}
    // Repair common LLM quirks and try again
    try {
      const r = t
        .replace(/,\s*([}\]])/g, "$1")                         // trailing commas
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') // unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"')                    // single-quoted values
        .replace(/[\x00-\x1F\x7F]/g, " ");                     // control chars
      return JSON.parse(r);
    } catch {}
    return null; // give up — never throw
  } catch { return null; }
}
const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

// Guarantees the scorecard has every field the interactive card needs, with
// safe defaults — so a slightly-malformed model response still renders a
// proper report instead of dumping raw JSON.
const DEFAULT_CATS = [
  { name:"Opening & rapport", score:0, max:10 },
  { name:"Discovery & qualification", score:0, max:20 },
  { name:"Program routing & fit", score:0, max:15 },
  { name:"Value framing", score:0, max:15 },
  { name:"Objection handling", score:0, max:20 },
  { name:"Pricing, EMI & trust", score:0, max:10 },
  { name:"Close & next step", score:0, max:10 },
];
function normalizeScorecard(c) {
  if (!c || typeof c !== "object") return null;
  const arr = (v) => Array.isArray(v) ? v.filter(x => typeof x === "string" && x.trim()) : [];
  const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  let cats = Array.isArray(c.categories) && c.categories.length
    ? c.categories.map((x, i) => ({
        name: (x && x.name) || DEFAULT_CATS[i]?.name || `Category ${i+1}`,
        score: num(x && x.score, 0, num(x && x.max, 1, 100, DEFAULT_CATS[i]?.max || 10), 0),
        max: num(x && x.max, 1, 100, DEFAULT_CATS[i]?.max || 10),
      }))
    : DEFAULT_CATS;
  let overall = num(c.overall, 0, 100, NaN);
  if (!Number.isFinite(overall)) {
    const tot = cats.reduce((a,x)=>a+x.score,0), max = cats.reduce((a,x)=>a+x.max,0);
    overall = max ? Math.round((tot/max)*100) : 0;
  }
  return {
    overall,
    recommendedProgram: c.recommendedProgram || "Unclear",
    correctRouting: !!c.correctRouting,
    flags: arr(c.flags),
    categories: cats,
    strengths: arr(c.strengths),
    lostPoints: arr(c.lostPoints),
    missed: arr(c.missed),
    sayNextTime: arr(c.sayNextTime),
    behavioral: (c.behavioral && typeof c.behavioral === "object") ? {
      pace: c.behavioral.pace || "—",
      tone: c.behavioral.tone || "—",
      talkTime: c.behavioral.talkTime || "—",
      redFlags: c.behavioral.redFlags || "—",
    } : null,
  };
}
const cleanForTTS = t => t.replace(/[*_`#>~]/g, "").replace(/\s+/g, " ").trim();
// Speak only the first 2 sentences — keeps TTS snappy during a live call.
// The full reply is always visible in the chat bubble.
const ttsSnippet = text => {
  const clean = cleanForTTS(text);
  const sentences = clean.match(/[^.!?…]+[.!?…]+/g) || [];
  return sentences.length ? sentences.slice(0, 2).join(" ").trim() : clean.slice(0, 220);
};
// Known male/female voice-name hints across Chrome / Edge / macOS / mobile.
const FEMALE_HINTS = /(female|woman|samantha|aria|libby|jenny|sonia|neerja|swara|kalpana|heera|veena|tessa|fiona|karen|moira|zira|hazel|google uk english female|google us english.*female)/i;
const MALE_HINTS   = /(\bmale\b|\bman\b|prabhat|ravi|hemant|guy|david|mark|rishi|alex|daniel|fred|oliver|george|google uk english male)/i;

function pickVoice(voices, lang, gender) {
  if (!voices.length) return null;
  const norm = s => (s || "").replace("_", "-").toLowerCase();
  const wantIN = /in$/i.test(lang || "");
  const en = voices.filter(v => /^en/i.test(v.lang));
  // Prefer Indian-English voices when the persona is Indian
  const pool = wantIN ? (en.filter(v => /in$/i.test(v.lang)).length ? en.filter(v => /in$/i.test(v.lang)) : en) : en;

  const matchGender = v => {
    if (gender === "female") return FEMALE_HINTS.test(v.name) && !MALE_HINTS.test(v.name);
    if (gender === "male")   return MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name);
    return true;
  };
  const isNatural = v => /google|natural|neural|premium|enhanced/i.test(v.name);

  // 1) natural + right gender, 2) right gender, 3) natural, 4) exact lang, 5) anything
  return (
    pool.find(v => isNatural(v) && matchGender(v)) ||
    pool.find(v => matchGender(v)) ||
    pool.find(v => isNatural(v)) ||
    pool.find(v => norm(v.lang) === norm(lang || "")) ||
    pool[0] || en[0] || voices[0] || null
  );
}

/* ================================================================== */
export default function App() {
  const [section, setSection] = useState("cover"); // cover | dept | home | salesuccess | practice | realcall | reports | followups

  // Global background music — persists across every page.
  const [musicOn, setMusicOn] = useState(true);
  const [musicStarted, setMusicStarted] = useState(false);
  useEffect(() => {
    // Browsers block audio until the first user gesture — start on the very
    // first tap/click/key anywhere, then it keeps playing across pages.
    const start = () => setMusicStarted(true);
    const evs = ["pointerdown", "touchstart", "keydown"];
    evs.forEach(e => window.addEventListener(e, start, { once: true, passive: true }));
    return () => evs.forEach(e => window.removeEventListener(e, start));
  }, []);

  const [screen, setScreen] = useState("setup");
  const [mode, setMode] = useState("learner");
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [err, setErr] = useState("");

  const [card, setCard] = useState(null);
  const [cardRaw, setCardRaw] = useState("");
  const [grading, setGrading] = useState(false);
  const [history, setHistory] = useState([]);

  // Feature 1: rep name
  const [repName, setRepName] = useState("");
  // Feature 2: difficulty
  const [difficulty, setDifficulty] = useState("medium");
  // Feature 3: call stage progress
  const [callStage, setCallStage] = useState(0);
  // Feature 4: live hints
  const [hint, setHint] = useState("");
  // Feature 5: mood meter
  const [mood, setMood] = useState("neutral");

  // voice
  const [voiceWanted, setVoiceWanted] = useState(false);
  const [voiceOn, _setVoiceOn] = useState(false);
  const [handsFree, _setHandsFree] = useState(true);
  const [listening, _setListening] = useState(false);
  const [speaking, _setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, _setRate] = useState(1.45); // TTS speaking speed — fast enough for a live call

  const scrollRef = useRef(null);

  // refs (for stable callbacks / speech handlers)
  const recognitionRef = useRef(null);
  const voiceOnRef = useRef(false);
  const handsFreeRef = useRef(true);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const busyRef = useRef(false);
  const callActiveRef = useRef(false);
  const blockedRef = useRef(false);
  const apiMsgsRef = useRef([]);
  const sysRef = useRef("");
  const voiceRef = useRef(null);
  const genderRef = useRef("female");
  const rateRef = useRef(1.15);
  const finalRef = useRef("");
  const speakRef = useRef(() => {});
  const listenRef = useRef(() => {});

  const setVoiceOn = v => { voiceOnRef.current = v; _setVoiceOn(v); };
  const setHandsFree = v => { handsFreeRef.current = v; _setHandsFree(v); };
  const setListening = v => { listeningRef.current = v; _setListening(v); };
  const setSpeaking = v => { speakingRef.current = v; _setSpeaking(v); };
  const setRate = v => { rateRef.current = v; _setRate(v); };

  const sttSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && !!window.speechSynthesis;

  const activePersona = useCustom
    ? { id:"custom", name:"Custom prospect", tag:"Your own scenario", route:"—", mood:"—", ttsLang:"en-US",
        lead:"Custom scenario you defined.", stated:"—", blocker:"—",
        brief:`You are a prospective OutSkill learner: ${custom || "a generic interested prospect from the workshop"}. Behave realistically, raise natural objections, keep spoken replies to 1-2 sentences, stay in character, never reveal you are an AI.` }
    : persona;
  const difficultyModifier = difficulty === "easy"
    ? "\nDIFFICULTY: Easy mode — be cooperative, warm, raise only one mild objection, don't probe too hard."
    : difficulty === "hard"
    ? "\nDIFFICULTY: Hard mode — be skeptical and terse, interrupt occasionally, ask multiple pointed objections, challenge pricing aggressively."
    : "";
  const sysPrompt = (mode === "learner" ? learnerSystem(activePersona) : agentSystem()) + difficultyModifier;

  /* sync refs */
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { apiMsgsRef.current = messages; }, [messages]);
  useEffect(() => { sysRef.current = sysPrompt; }, [sysPrompt]);
  useEffect(() => {
    callActiveRef.current = screen === "call";
    if (screen !== "call") stopAll();
  }, [screen]);

  /* load voices */
  useEffect(() => {
    const synth = window.speechSynthesis; if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    load(); synth.onvoiceschanged = load;
    return () => { try { synth.onvoiceschanged = null; } catch {} };
  }, []);
  useEffect(() => {
    const v = voices.find(x => x.voiceURI === voiceURI) || pickVoice(voices, activePersona.ttsLang, activePersona.gender);
    voiceRef.current = v || null;
    genderRef.current = activePersona.gender || "female";
  }, [voices, voiceURI, activePersona]);

  /* load history */
  useEffect(() => {
    try { const v = localStorage.getItem("sarafai_history_v1"); if (v) setHistory(JSON.parse(v)); } catch {}
  }, []);

  /* Feature 1: load repName from localStorage */
  useEffect(() => {
    try { const v = localStorage.getItem("sarafai_repname"); if (v) setRepName(v); } catch {}
  }, []);

  /* autoscroll */
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy, interim]);

  /* timer */
  useEffect(() => {
    if (screen !== "call") return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [screen]);

  /* ---- voice engine ---- */
  const stopAll = useCallback(() => {
    try { recognitionRef.current && recognitionRef.current.abort(); } catch {}
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
    setListening(false); setSpeaking(false); setInterim("");
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current || speakingRef.current || busyRef.current || blockedRef.current) return;
    const rec = recognitionRef.current; if (!rec) return;
    setInterim("");
    try { rec.start(); } catch {}
  }, []);
  useEffect(() => { listenRef.current = startListening; }, [startListening]);

  const speak = useCallback((text) => {
    const reArm = () => {
      if (handsFreeRef.current && callActiveRef.current && voiceOnRef.current && !blockedRef.current) {
        setTimeout(() => listenRef.current(), 120);
      }
    };
    const synth = window.speechSynthesis;
    if (!synth) { reArm(); return; }
    try { synth.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(ttsSnippet(text));
    if (voiceRef.current) u.voice = voiceRef.current;
    // Lively, engaging delivery — female slightly brighter, male a touch warmer.
    // A small random jitter on pitch/rate keeps it from sounding flat & robotic.
    const jitter = (Math.random() - 0.5) * 0.06;
    u.rate = rateRef.current + jitter;
    u.pitch = (genderRef.current === "male" ? 0.92 : 1.12) + jitter;
    u.volume = 1;
    setSpeaking(true);
    u.onend = () => { setSpeaking(false); reArm(); };
    u.onerror = () => { setSpeaking(false); reArm(); };
    try { synth.speak(u); } catch { setSpeaking(false); reArm(); }
  }, []);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  const sendText = useCallback(async (text) => {
    const t = (text || "").trim();
    if (!t || busyRef.current) return;
    const next = [...apiMsgsRef.current, { role: "user", content: t }];
    setMessages(next); apiMsgsRef.current = next; setInput("");
    setBusy(true); busyRef.current = true; setErr("");
    try {
      const reply = await callClaude({ system: sysRef.current, messages: next.map(({ role, content }) => ({ role, content })) });
      const after = [...next, { role: "assistant", content: reply }];
      setMessages(after); apiMsgsRef.current = after;
      if (voiceOnRef.current) speakRef.current(reply);
      // Feature 3: auto-advance call stage
      const msgCount = after.length;
      const newStage = msgCount <= 2 ? 0 : msgCount <= 5 ? 1 : msgCount <= 8 ? 2 : msgCount <= 11 ? 3 : msgCount <= 15 ? 4 : 5;
      setCallStage(newStage);
      // Feature 4: derive hint
      const replyLow = reply.toLowerCase();
      const lastUserMsg = (next[next.length - 1]?.content || "").toLowerCase();
      let newHint = "";
      if (newStage === 0) {
        if (!replyLow.includes("name") && !replyLow.includes("how are")) newHint = "💡 Open with warmth — use their name and acknowledge they attended the workshop";
      } else if (newStage === 1) {
        if (!replyLow.includes("python") && !replyLow.includes("technical") && !replyLow.includes("background")) newHint = "💡 Ask about their background — coding or non-technical? This drives the whole call";
      } else if (newStage === 2) {
        newHint = "💡 Confirm the right program — Generalist (no-code) or Engineering (Python)?";
      } else if (newStage === 3) {
        newHint = "💡 Tie the program benefits to what they said they want — personalise the pitch";
      } else if (newStage === 4) {
        if (lastUserMsg.includes("expensive") || lastUserMsg.includes("price") || lastUserMsg.includes("cost") || lastUserMsg.includes("emi")) newHint = "💡 Acknowledge, then isolate — 'If budget wasn't a concern, would you join today?'";
      } else if (newStage === 5) {
        newHint = "💡 Trial close — 'What would need to happen for you to feel confident saying yes today?'";
      }
      setHint(newHint);
      // Feature 5: detect mood
      let newMood = "neutral";
      if (replyLow.includes("interested") || replyLow.includes("tell me more") || replyLow.includes("sounds good") || replyLow.includes("that's helpful")) {
        newMood = "interested";
      } else if (replyLow.includes("yes") || replyLow.includes("let's do") || replyLow.includes("sounds great") || replyLow.includes("sign me up") || replyLow.includes("enroll")) {
        newMood = "hot";
      } else if (replyLow.includes("not interested") || replyLow.includes("no thanks") || replyLow.includes("too expensive") || replyLow.includes("can't afford") || replyLow.includes("busy")) {
        newMood = "cold";
      }
      setMood(newMood);
    } catch {
      setErr("That turn didn't go through. Check your connection and try again.");
    } finally { setBusy(false); busyRef.current = false; }
  }, []);

  /* recognition init (once) */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = "en-IN";
    rec.maxAlternatives = 1;
    rec.onstart = () => { finalRef.current = ""; setListening(true); };
    rec.onresult = (e) => {
      let it = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else it += r[0].transcript;
      }
      setInterim(finalRef.current + it);
    };
    let netRetries = 0;
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        blockedRef.current = true; setVoiceBlocked(true); setListening(false); return;
      }
      if (e.error === "network") {
        setListening(false);
        if (netRetries < 2 && voiceOnRef.current && callActiveRef.current) {
          netRetries++;
          setTimeout(() => { try { rec.start(); } catch {} }, 600);
        } else {
          // Give up on voice — silently fall back to text mode
          setVoiceOn(false);
          blockedRef.current = true; setVoiceBlocked(true);
        }
        return;
      }
      // no-speech / aborted / audio-capture — reset quietly
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const t = finalRef.current.trim(); finalRef.current = ""; setInterim("");
      if (t) { netRetries = 0; sendText(t); }
      else if (handsFreeRef.current && callActiveRef.current && voiceOnRef.current && !blockedRef.current && !busyRef.current) {
        setTimeout(() => { try { rec.start(); } catch {} }, 200);
      }
    };
    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
  }, [sendText]);

  const enableVoice = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasTTS = !!window.speechSynthesis;
    if (!SR && !hasTTS) { blockedRef.current = true; setVoiceBlocked(true); setVoiceOn(false); return; }
    try { window.speechSynthesis && window.speechSynthesis.resume(); } catch {}
    let blocked = false;
    if (SR && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
      catch { blocked = true; }
    } else if (!SR) { blocked = true; }
    blockedRef.current = blocked; setVoiceBlocked(blocked);
    setVoiceOn(true);
  }, []);

  const onMicTap = () => {
    if (busy) return;
    if (speaking) { try { window.speechSynthesis.cancel(); } catch {}; setSpeaking(false); listenRef.current(); return; }
    if (listening) { const rec = recognitionRef.current; if (rec) { try { rec.stop(); } catch {} } return; }
    listenRef.current();
  };

  /* ---- call lifecycle ---- */
  // Either side may open the call. We DON'T auto-fire a line — the human can
  // speak/type first, or tap "Let them open" to have the other side start.
  const startCall = async () => {
    setErr(""); setSeconds(0); setCard(null); setCardRaw(""); setInterim("");
    setCallStage(0); setHint(""); setMood("neutral");
    if (voiceWanted) { await enableVoice(); } else { setVoiceOn(false); }
    setMessages([]); apiMsgsRef.current = [];
    setScreen("call"); callActiveRef.current = true;
    // In hands-free voice, arm the mic so the human can simply start talking.
    if (voiceOnRef.current && handsFreeRef.current && !blockedRef.current) {
      setTimeout(() => listenRef.current(), 200);
    }
  };

  // Have the OTHER side deliver the first line (the prospect picks up, or the
  // rep opens) — only valid before anyone has spoken.
  const letThemOpen = async () => {
    if (busyRef.current || apiMsgsRef.current.length) return;
    stopAll();
    const primer = mode === "learner"
      ? { role:"user", content:"[It's a sales call and your phone is ringing. Answer it now with a short, natural spoken greeting in character — and nothing else. Let the caller, the OutSkill rep, lead.]", hidden:true }
      : { role:"user", content:"[Begin the call now as the OutSkill rep. Give only your opening line: a warm greeting, reference the workshop they attended, and a light check-in. Keep it short.]", hidden:true };
    setMessages([primer]); apiMsgsRef.current = [primer];
    setBusy(true); busyRef.current = true; setErr("");
    try {
      const reply = await callClaude({ system: sysRef.current, messages: [{ role: primer.role, content: primer.content }] });
      const after = [primer, { role: "assistant", content: reply }];
      setMessages(after); apiMsgsRef.current = after;
      if (voiceOnRef.current) speakRef.current(reply);
    } catch (e) {
      setMessages([]); apiMsgsRef.current = [];
      setErr((e && e.message) ? e.message : "Couldn't reach the model. Check the server is running and try again.");
    } finally { setBusy(false); busyRef.current = false; }
  };

  const endCall = async () => {
    stopAll();
    const visible = apiMsgsRef.current.filter(m => !m.hidden);
    if (visible.length < 2) { setScreen("setup"); return; }
    setGrading(true); setErr(""); setScreen("feedback");
    const transcript = visible.map(m => {
      const who = mode === "learner" ? (m.role === "user" ? "REP" : "LEARNER") : (m.role === "assistant" ? "REP" : "LEARNER");
      return `${who}: ${m.content}`;
    }).join("\n");
    try {
      const raw = await callClaude({ system: evaluatorSystem(mode, useCustom ? null : activePersona, fmtTime(seconds)), messages: [{ role: "user", content: `TRANSCRIPT:\n${transcript}` }], json: true });
      let parsed = null;
      try { parsed = normalizeScorecard(parseScorecard(raw)); } catch { parsed = null; }
      if (!parsed) setCardRaw(raw);
      if (parsed) {
        setCard(parsed);
        const entry = { date: Date.now(), persona: activePersona.name, mode, overall: parsed.overall, correctRouting: parsed.correctRouting };
        const nh = [entry, ...history].slice(0, 20); setHistory(nh);
        try { localStorage.setItem("sarafai_history_v1", JSON.stringify(nh)); } catch {}
      }
      // Save the full call (transcript + scorecard) to disk for later review.
      try {
        await fetch("/api/save-call", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ts: Date.now(), mode,
            persona: activePersona.name, personaTag: activePersona.tag,
            duration: fmtTime(seconds),
            overall: parsed ? parsed.overall : null,
            correctRouting: parsed ? parsed.correctRouting : null,
            scorecard: parsed || null,
            scorecardRaw: parsed ? null : raw,
            transcript,
            messages: visible,
          }),
        });
      } catch {}
    } catch {
      setErr("Couldn't generate the scorecard. Try ending the call again.");
    } finally { setGrading(false); }
  };

  const reset = () => { stopAll(); setScreen("setup"); setMessages([]); apiMsgsRef.current = []; setCard(null); setCardRaw(""); setErr(""); setSeconds(0); setInterim(""); setCallStage(0); setHint(""); setMood("neutral"); };

  /* ---- render ---- */
  const root = {
    minHeight:"100vh", background:INK, color:TXT,
    fontFamily:"'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
    backgroundImage:`radial-gradient(900px 500px at 88% -8%, rgba(194,238,69,0.10), transparent 60%), radial-gradient(700px 500px at -5% 108%, rgba(194,238,69,0.06), transparent 55%)`,
  };
  const serif = { fontFamily:"'Fraunces', Georgia, serif" };
  const enVoices = voices.filter(v => /^en/i.test(v.lang));

  const voiceApi = {
    on: voiceOn, listening, speaking, busy, interim, blocked: voiceBlocked,
    handsFree, setHandsFree, onMicTap,
    enVoices, voiceURI, setVoiceURI, rate, setRate,
    enable: () => enableVoice(), disable: () => { stopAll(); setVoiceOn(false); },
    sttSupported, ttsSupported,
  };

  return (
    <div style={root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        .osf{animation:osf .45s ease both}@keyframes osf{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        .osd{display:inline-block;width:6px;height:6px;border-radius:50%;background:${MUTE};margin:0 2px;animation:osb 1.2s infinite both}
        .osd:nth-child(2){animation-delay:.18s}.osd:nth-child(3){animation-delay:.36s}
        @keyframes osb{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(194,238,69,.45)}70%{box-shadow:0 0 0 22px rgba(194,238,69,0)}100%{box-shadow:0 0 0 0 rgba(194,238,69,0)}}
        @keyframes bob{0%,100%{transform:scaleY(.5)}50%{transform:scaleY(1)}}
        textarea,input,select{outline:none}
        .oscroll::-webkit-scrollbar{width:8px}.oscroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:8px}
        button{cursor:pointer;font-family:inherit;color:inherit}
        select{background:${PANEL};color:${TXT};border:1px solid ${BORDER};border-radius:9px;padding:6px 9px;font-size:12px}
        /* Cover credit: pinned to bottom-right, same line as the music button */
        .os-credit{position:fixed;bottom:16px;right:16px;z-index:60;display:inline-flex;align-items:center;gap:9px;background:rgba(194,238,69,0.07);border:1px solid rgba(194,238,69,0.38);border-radius:30px;padding:9px 16px}
      `}</style>

      <div style={{ maxWidth: 960, margin:"0 auto", padding:"22px 18px 60px" }}>
        {section !== "cover" && section !== "dept" && (
          <Header serif={serif} section={section} goHome={() => { if (screen === "call") return; reset(); setSection("home"); }} inCall={screen === "call"} />
        )}

        {section === "cover" && (
          <Cover serif={serif} onEnter={() => setSection("dept")}
            musicOn={musicOn} musicStarted={musicStarted}
            setMusicOn={setMusicOn} setMusicStarted={setMusicStarted} />
        )}

        {section === "dept" && (
          <DeptSelect serif={serif} goBack={() => setSection("cover")}
            onInsideSales={() => setSection("home")}
            onSaleSuccess={() => setSection("salesuccess")} />
        )}

        {section === "home" && (
          <Home serif={serif} go={setSection} history={history} goBack={() => setSection("dept")} />
        )}

        {section === "salesuccess" && (
          <SaleSuccess serif={serif} goBack={() => setSection("dept")} />
        )}

        {section === "practice" && (<>
          {screen === "setup" && (
            <Setup serif={serif} mode={mode} setMode={setMode} persona={persona} setPersona={setPersona}
              useCustom={useCustom} setUseCustom={setUseCustom} custom={custom} setCustom={setCustom}
              startCall={startCall} history={history}
              voiceWanted={voiceWanted} setVoiceWanted={setVoiceWanted} sttSupported={sttSupported} ttsSupported={ttsSupported}
              repName={repName} setRepName={setRepName}
              difficulty={difficulty} setDifficulty={setDifficulty}/>
          )}
          {screen === "call" && (
            <CallView serif={serif} mode={mode} persona={activePersona}
              messages={messages.filter(m => !m.hidden)} busy={busy}
              input={input} setInput={setInput} send={() => sendText(input)}
              seconds={seconds} endCall={endCall} err={err} scrollRef={scrollRef} voice={voiceApi}
              letThemOpen={letThemOpen}
              callStage={callStage} totalStages={6}
              hint={hint} setHint={setHint}
              mood={mood}/>
          )}
          {screen === "feedback" && (
            <Feedback serif={serif} mode={mode} persona={activePersona} card={card} cardRaw={cardRaw}
              grading={grading} err={err} reset={reset} again={startCall} duration={fmtTime(seconds)} useCustom={useCustom}
              repName={repName}/>
          )}
        </>)}

        {section === "realcall" && <RealCall serif={serif} goHome={() => setSection("home")} />}
        {section === "reports" && <Reports serif={serif} />}
        {section === "followups" && <FollowUps serif={serif} go={setSection} />}
      </div>

      {/* Page-specific music: Cover = RCB anthem, Home = hype track, others = silent */}
      {musicOn && musicStarted && section === "cover" && (
        <iframe key="music-cover"
          src="https://www.youtube.com/embed/ejmyPv0gf_0?autoplay=1&loop=1&playlist=ejmyPv0gf_0&controls=0&playsinline=1&mute=0"
          allow="autoplay; encrypted-media"
          style={{ position:"fixed", width:1, height:1, opacity:0, pointerEvents:"none", bottom:0, left:0 }}
          title="bg-music-cover"
        />
      )}
      {musicOn && musicStarted && section === "home" && (
        <iframe key="music-home"
          src="https://www.youtube.com/embed/3zbjjubp0kg?autoplay=1&loop=1&playlist=3zbjjubp0kg&controls=0&playsinline=1&mute=0"
          allow="autoplay; encrypted-media"
          style={{ position:"fixed", width:1, height:1, opacity:0, pointerEvents:"none", bottom:0, left:0 }}
          title="bg-music-home"
        />
      )}
      {/* Floating music toggle — home page only (cover has its own in-flow row) */}
      {section === "home" && (
        <button onClick={() => { if (!musicStarted) { setMusicStarted(true); setMusicOn(true); } else { setMusicOn(v => !v); } }}
          title={musicOn ? "Mute music" : "Play music"}
          style={{ position:"fixed", bottom:16, left:16, zIndex:60, display:"inline-flex", alignItems:"center", gap:7,
            background: musicOn ? "rgba(194,238,69,0.12)" : "rgba(20,20,16,0.9)",
            border:`1px solid ${musicOn ? "rgba(194,238,69,0.5)" : BORDER}`, borderRadius:30, padding:"9px 14px",
            color: musicOn ? TXT : MUTE, fontSize:12.5, boxShadow:"0 4px 18px rgba(0,0,0,0.35)" }}>
          {musicOn ? <Volume2 size={15} color={LIME}/> : <VolumeX size={15}/>}
          <span>{musicOn ? "Music on" : "Music off"}</span>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
const SECTION_TITLE = { home:"Inside Sales", salesuccess:"Sales Success", practice:"Practice Calls", realcall:"Real Call · Record & Report", reports:"Reports & Pipeline", followups:"Follow-ups" };
function Header({ serif, section, goHome, inCall }) {
  const atHome = section === "home";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
      <button onClick={goHome} disabled={inCall} title={inCall ? "Finish the call first" : "Home"}
        style={{ display:"flex", alignItems:"center", gap:12, background:"transparent", border:"none", padding:0, opacity: inCall?0.5:1 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,6px)", gap:3 }}>
          {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:6, height:6, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1px solid ${MUTE}` }} />))}
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ ...serif, fontSize:22, fontWeight:600, lineHeight:1, color:TXT }}>Outskill</div>
          <div style={{ fontSize:11.5, letterSpacing:1.5, textTransform:"uppercase", color:MUTE, marginTop:3 }}>{SECTION_TITLE[section] || "Sales Command Center"}</div>
        </div>
      </button>
      {!atHome && !inCall && (
        <button onClick={goHome} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5 }}>
          <ArrowLeft size={14}/><span style={{marginLeft:6}}>Home</span>
        </button>
      )}
      <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
        <div style={{ fontSize:11, color:MUTE, display:"flex", alignItems:"center", gap:6 }}>
          <Sparkles size={13} color={LIME_DIM}/> AI-powered
        </div>
        <div style={{ fontSize:10, color:MUTE, letterSpacing:1.5, textTransform:"uppercase" }}>By SARAF</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
// A soft ambient pad synthesized in-browser (no audio file, no licensing).
// Browsers block sound until a user gesture, so we attempt to start on mount
// AND on the first interaction.
function makeAmbience() {
  let ctx = null, gainNode = null, timer = null, idx = 0, muted = false;
  // "Ee Sala Cup Namde" RCB anthem melody in D major
  const MELODY = [
    587.33, 659.25, 739.99, 659.25,
    587.33, 523.25, 587.33, 659.25,
    739.99, 830.61, 739.99, 659.25,
    587.33, 523.25, 587.33, 493.88,
  ];
  const build = () => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;
    gainNode.connect(ctx.destination);
  };
  const note = (freq) => {
    if (!ctx || !gainNode || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.85, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(env);
    env.connect(gainNode);
    osc.start(t);
    osc.stop(t + 0.6);
  };
  const tick = () => { note(MELODY[idx++ % MELODY.length]); };
  return {
    start: (isMuted) => {
      muted = !!isMuted;
      build();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      if (!muted && !timer) { tick(); timer = setInterval(tick, 500); }
    },
    setMuted: (m) => {
      muted = m;
      if (!ctx) return;
      if (!m && !timer) { tick(); timer = setInterval(tick, 500); }
      if (m && timer) { clearInterval(timer); timer = null; }
    },
    stop: () => {
      if (timer) { clearInterval(timer); timer = null; }
      try { ctx && ctx.close(); ctx = null; } catch {}
    },
  };
}

function Cover({ serif, onEnter, musicOn, musicStarted, setMusicOn, setMusicStarted }) {
  useEffect(() => {
    const t = setTimeout(onEnter, 10000);
    const onKey = (e) => { if (e.key === "Enter" || e.key === " ") onEnter(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div onClick={onEnter} role="button" title="Enter"
      style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", cursor:"pointer", position:"relative", padding:"40px 18px 90px" }}>
      <div className="osf">
        {/* brand dot-mark */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:22 }}>
          {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow: d?`0 0 14px ${LIME}55`:"none" }} />))}
        </div>
        <div style={{ fontSize:"clamp(10px,3vw,13px)", letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:18, fontWeight:600 }}>OutSkill · Sales Department</div>
        <h1 style={{ ...serif, fontSize:"clamp(34px, 9vw, 92px)", fontWeight:600, lineHeight:1.05, margin:"0 0 18px", letterSpacing:-1 }}>
          Where conversations<br/><span style={{ color:LIME }}>become conversions.</span>
        </h1>
        <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,18px)", maxWidth:580, margin:"0 auto", lineHeight:1.55 }}>
          The command center for OutSkill's sales team — train, call, report, and follow up. All in one place.
        </p>
        <div style={{ marginTop:30, fontSize:12.5, color:MUTE, display:"inline-flex", alignItems:"center", gap:9 }}>
          <span className="osd"/><span className="osd"/><span className="osd"/>
          <span style={{ marginLeft:4 }}>tap anywhere to enter</span>
        </div>

        {/* Music + credit row — centered, just below the tap line */}
        <div onClick={(e)=>e.stopPropagation()} style={{ marginTop:26, display:"flex", flexWrap:"wrap", justifyContent:"center", alignItems:"center", gap:12 }}>
          <button onClick={() => { if (!musicStarted) { setMusicStarted(true); setMusicOn(true); } else { setMusicOn(v => !v); } }}
            title={musicOn ? "Mute music" : "Play music"}
            style={{ display:"inline-flex", alignItems:"center", gap:7,
              background: musicOn ? "rgba(194,238,69,0.12)" : "rgba(20,20,16,0.9)",
              border:`1px solid ${musicOn ? "rgba(194,238,69,0.5)" : BORDER}`, borderRadius:30, padding:"9px 14px",
              color: musicOn ? TXT : MUTE, fontSize:12.5 }}>
            {musicOn ? <Volume2 size={15} color={LIME}/> : <VolumeX size={15}/>}
            <span>{musicOn ? "Music on" : "Music off"}</span>
          </button>
          <div style={{ display:"inline-flex", alignItems:"center", gap:9, background:"rgba(194,238,69,0.07)", border:`1px solid rgba(194,238,69,0.38)`, borderRadius:30, padding:"9px 16px" }}>
            <span style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:MUTE }}>Built by</span>
            <span style={{ ...serif, fontSize:14, fontWeight:600, letterSpacing:1.5, color:LIME }}>GARVIT SARAF</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Home({ serif, go, history, goBack }) {
  const avg = history.length ? Math.round(history.reduce((a,h)=>a+h.overall,0)/history.length) : null;
  const tiles = [
    { id:"practice", icon:<GraduationCap size={22}/>, title:"Practice Calls", desc:"Train new reps against realistic AI prospects, then get an instant coaching scorecard.", tag: avg!==null ? `${history.length} practiced · avg ${avg}` : "Mock call + coaching" },
    { id:"realcall", icon:<Mic size={22}/>, title:"Real Call · Record & Report", desc:"Upload a recording of a real learner call. Get a transcript and a CRM-ready report with next steps.", tag:"Upload → transcribe → report" },
    { id:"reports", icon:<TrendingUp size={22}/>, title:"Reports & Pipeline", desc:"Every real call in one place — interest level, intent, and how many learners you contacted.", tag:"Sales head + management view" },
    { id:"followups", icon:<Clock size={22}/>, title:"Follow-ups", desc:"Who to call back and when, with what you already discussed and what's still open.", tag:"Never miss a callback" },
  ];
  return (
    <div className="osf">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <button onClick={goBack} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5 }}>
          <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back to start</span>
        </button>
      </div>
      <h1 style={{ ...serif, fontSize:"clamp(28px,7vw,40px)", fontWeight:600, margin:"0 0 8px", letterSpacing:-0.7 }}>Welcome back. What's the move?</h1>
      <p style={{ color:MUTE, margin:"0 0 28px", fontSize:"clamp(14px,4vw,16.5px)", maxWidth:600, lineHeight:1.5 }}>
        Train new joiners on mock calls, then run, record and report on real learner calls — all in one place.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:14 }}>
        {tiles.map(t=>(
          <button key={t.id} onClick={()=>go(t.id)} style={{ textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:18, padding:"20px 20px 18px", transition:"all .16s ease" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.5)";e.currentTarget.style.background="rgba(194,238,69,0.06)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:50, height:50, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", color:LIME, flexShrink:0 }}>{t.icon}</div>
              <span style={{ ...serif, fontSize:20.5, fontWeight:600 }}>{t.title}</span>
              <ChevronRight size={19} color={MUTE} style={{ marginLeft:"auto" }}/>
            </div>
            <div style={{ fontSize:14.5, color:MUTE, lineHeight:1.5, marginBottom:12, minHeight:42 }}>{t.desc}</div>
            <div style={{ fontSize:11.5, letterSpacing:.4, textTransform:"uppercase", color:LIME_DIM, fontWeight:600 }}>{t.tag}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
// Team access passwords. Change these to whatever your team should use.
const PASSWORDS = { inside: "inside123", success: "success123" };

function DeptSelect({ serif, goBack, onInsideSales, onSaleSuccess }) {
  const [gate, setGate] = useState(null); // null | "inside" | "success"
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const open = (which) => { setGate(which); setPw(""); setError(""); };
  const submit = () => {
    if (pw === PASSWORDS[gate]) {
      const fn = gate === "inside" ? onInsideSales : onSaleSuccess;
      setGate(null); setPw(""); setError("");
      fn();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="osf" style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 18px", position:"relative" }}>
      {/* brand dot-mark */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:20 }}>
        {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow: d?`0 0 14px ${LIME}55`:"none" }} />))}
      </div>
      <div style={{ fontSize:"clamp(10px,3vw,12px)", letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:14, fontWeight:600 }}>OutSkill · Sales Department</div>
      <h1 style={{ ...serif, fontSize:"clamp(28px,6vw,58px)", fontWeight:600, lineHeight:1.1, margin:"0 0 12px", letterSpacing:-1 }}>
        Which team are you on?
      </h1>
      <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,16px)", maxWidth:480, margin:"0 auto 40px", lineHeight:1.55 }}>
        Select your sales track. Team password required for access.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, width:"100%", maxWidth:560 }}>
        <button onClick={()=>open("inside")}
          style={{ textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 22px", transition:"all .16s ease", cursor:"pointer" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.6)";e.currentTarget.style.background="rgba(194,238,69,0.07)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
          <div style={{ width:48, height:48, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <Phone size={22} color={LIME}/>
          </div>
          <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:8 }}>Inside Sales</div>
          <div style={{ fontSize:13.5, color:MUTE, lineHeight:1.5 }}>Mock call training, real call reporting, pipeline and follow-ups.</div>
          <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:LIME, fontWeight:600 }}>
            🔒 Enter <ChevronRight size={14}/>
          </div>
        </button>

        <button onClick={()=>open("success")}
          style={{ textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 22px", transition:"all .16s ease", cursor:"pointer" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.6)";e.currentTarget.style.background="rgba(194,238,69,0.07)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
          <div style={{ width:48, height:48, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <TrendingUp size={22} color={LIME}/>
          </div>
          <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:8 }}>Sales Success</div>
          <div style={{ fontSize:13.5, color:MUTE, lineHeight:1.5 }}>Coming soon — details being added.</div>
          <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:LIME, fontWeight:600 }}>
            🔒 Enter <ChevronRight size={14}/>
          </div>
        </button>
      </div>

      <button onClick={goBack} style={{ ...secondaryBtn, marginTop:32, padding:"8px 16px", fontSize:12.5 }}>
        <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back</span>
      </button>

      {/* Password modal */}
      {gate && (
        <div onClick={()=>setGate(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:18, zIndex:50 }}>
          <div onClick={e=>e.stopPropagation()} className="osf"
            style={{ background:"#11140d", border:`1px solid ${BORDER}`, borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:380, textAlign:"center" }}>
            <div style={{ width:54, height:54, borderRadius:16, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:24 }}>🔒</div>
            <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:6 }}>{gate === "inside" ? "Inside Sales" : "Sales Success"}</div>
            <div style={{ fontSize:13.5, color:MUTE, marginBottom:18 }}>Enter the team password to continue.</div>
            <input type="password" autoFocus value={pw}
              onChange={e=>{ setPw(e.target.value); setError(""); }}
              onKeyDown={e=>{ if(e.key==="Enter") submit(); }}
              placeholder="Password"
              style={{ width:"100%", background:PANEL, border:`1px solid ${error?"#e87a6b":BORDER}`, borderRadius:12, padding:"13px 15px", color:TXT, fontSize:15, textAlign:"center", marginBottom:error?8:16 }}/>
            {error && <div style={{ fontSize:12.5, color:"#e87a6b", marginBottom:14 }}>{error}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setGate(null)} style={{ ...secondaryBtn, flex:1, justifyContent:"center" }}>Cancel</button>
              <button onClick={submit} style={{ ...primaryBtn, flex:1, justifyContent:"center" }}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function SaleSuccess({ serif, goBack }) {
  return (
    <div className="osf" style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"0 18px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:20 }}>
        {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow: d?`0 0 14px ${LIME}55`:"none" }} />))}
      </div>
      <div style={{ fontSize:12, letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:14, fontWeight:600 }}>OutSkill · Sales Success</div>
      <h1 style={{ ...serif, fontSize:"clamp(36px,6vw,64px)", fontWeight:600, lineHeight:1.1, margin:"0 0 16px", letterSpacing:-1 }}>
        Sales Success
      </h1>
      <p style={{ color:MUTE, fontSize:16, maxWidth:440, margin:"0 auto 32px", lineHeight:1.55 }}>
        This section is being built. Check back soon.
      </p>
      <button onClick={goBack} style={{ ...secondaryBtn, padding:"9px 20px", fontSize:13 }}>
        <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const fmtDay = ts => ts ? new Date(ts).toLocaleDateString(undefined,{ weekday:"short", month:"short", day:"numeric" }) : "—";
const INTEREST_COL = { Hot: LIME, Warm:"#e8d24b", Cold:"#9aa18c" };
const PROCEED_COL = { Yes: LIME_DIM, Maybe:"#e8d24b", No:"#e87a6b" };
function Badge({ label, color }) {
  return <span style={{ display:"inline-flex", alignItems:"center", fontSize:12, fontWeight:600, color, background:`${color}1f`, border:`1px solid ${color}55`, borderRadius:30, padding:"4px 11px" }}>{label}</span>;
}

/* ------------------------------------------------------------------ */
function RealCall({ serif, goHome }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [program, setProgram] = useState("");
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("form"); // form | working | done | error
  const [stage, setStage] = useState("");
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState("");

  const run = async () => {
    if (!name.trim() || !file) { setErr("Add the learner's name and pick an audio file."); return; }
    setErr(""); setStep("working");
    const ts = Date.now();
    try {
      setStage("Transcribing the recording locally…");
      const fd = new FormData();
      fd.append("audio", file); fd.append("learnerName", name); fd.append("ts", String(ts));
      const tr = await fetch("/api/transcribe", { method:"POST", body: fd });
      const td = await tr.json();
      if (!tr.ok) throw new Error(td.message || "Transcription failed.");

      setStage("Analyzing the call and writing the report…");
      const meta = `Learner: ${name}${phone?` (phone ${phone})`:""}${program?` · expressed interest: ${program}`:""}.`;
      const raw = await callClaude({ system: reportSystem(), messages:[{ role:"user", content:`${meta}\n\nTRANSCRIPT:\n${td.transcript}` }], json:true });
      let report = null;
      try { report = parseScorecard(raw); } catch { throw new Error("Couldn't parse the report. Try again."); }
      const followUpDate = ts + (Math.max(1, Math.min(30, report.followUpInDays||3)) * 86400000);

      const record = { id: td.id, ts, learnerName:name, phone, programInterest:program, audioFile: td.audioFile, transcript: td.transcript, report, followUpDate, followUpDone:false };
      setStage("Saving…");
      await fetch("/api/real-call", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(record) });
      setRec(record); setStep("done");
    } catch (e) {
      setErr((e && e.message) || "Something went wrong."); setStep("error");
    }
  };

  if (step === "done" && rec) return (
    <div className="osf">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <CheckCircle2 size={20} color={LIME}/>
        <h2 style={{ ...serif, fontSize:24, fontWeight:600, margin:0 }}>Call report ready</h2>
      </div>
      <ReportView rec={rec} serif={serif}/>
      <div style={{ display:"flex", gap:12, marginTop:22, flexWrap:"wrap" }}>
        <button onClick={()=>{ setStep("form"); setRec(null); setName(""); setPhone(""); setProgram(""); setFile(null); }} style={primaryBtn}><Mic size={16}/><span style={{marginLeft:8}}>Log another call</span></button>
        <button onClick={goHome} style={secondaryBtn}><ArrowLeft size={15}/><span style={{marginLeft:7}}>Home</span></button>
      </div>
    </div>
  );

  if (step === "working") return (
    <div className="osf" style={{ textAlign:"center", padding:"70px 0" }}>
      <Loader2 size={34} color={LIME} style={{ animation:"spin 1s linear infinite" }}/>
      <div style={{ ...serif, fontSize:22, marginTop:18 }}>{stage}</div>
      <div style={{ color:MUTE, fontSize:13.5, marginTop:8 }}>Transcription runs privately on this machine — the audio never leaves your computer.</div>
    </div>
  );

  return (
    <div className="osf">
      <h1 style={{ ...serif, fontSize:33, fontWeight:600, margin:"0 0 6px" }}>Record a real call</h1>
      <p style={{ color:MUTE, margin:"0 0 22px", fontSize:14.5, maxWidth:580 }}>
        Had a call with a learner on your phone? Upload the recording. It's transcribed locally, then turned into a CRM report with the next follow-up.
      </p>
      <div style={{ display:"grid", gap:13, maxWidth:560 }}>
        <Field label="Learner name *"><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Priya Sharma" style={inputStyle}/></Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
          <Field label="Phone (optional)"><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91…" style={inputStyle}/></Field>
          <Field label="Interested in (optional)">
            <select value={program} onChange={e=>setProgram(e.target.value)} style={{ ...inputStyle, padding:"11px 12px" }}>
              <option value="">Not sure yet</option><option>Generalist</option><option>Engineering</option>
            </select>
          </Field>
        </div>
        <Field label="Call recording *">
          <label style={{ display:"flex", alignItems:"center", gap:12, background:PANEL, border:`1px dashed ${file?LIME:BORDER}`, borderRadius:12, padding:"14px 16px", cursor:"pointer" }}>
            <AudioLines size={20} color={file?LIME:MUTE}/>
            <span style={{ fontSize:13.5, color: file?TXT:MUTE }}>{file ? file.name : "Choose an audio file (m4a, mp3, wav, aiff…)"}</span>
            <input type="file" accept="audio/*,.m4a,.aiff" onChange={e=>setFile(e.target.files?.[0]||null)} style={{ display:"none" }}/>
          </label>
        </Field>
      </div>
      {err && <div style={errStyle}>{err}</div>}
      <div style={{ marginTop:22 }}>
        <button onClick={run} style={primaryBtn}><Mic size={16}/><span style={{marginLeft:8}}>Transcribe &amp; build report</span></button>
      </div>
    </div>
  );
}

function ReportView({ rec, serif }) {
  const r = rec.report || {};
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ ...serif, fontSize:20, fontWeight:600 }}>{rec.learnerName}</div>
        {rec.phone && <span style={{ fontSize:12.5, color:MUTE }}>{rec.phone}</span>}
        <span style={{ fontSize:12, color:MUTE, marginLeft:"auto" }}>{fmtDay(rec.ts)}</span>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <Badge label={`Interest: ${r.interestLevel||"—"}`} color={INTEREST_COL[r.interestLevel]||MUTE}/>
        <Badge label={`Proceed: ${r.wantsToProceed||"—"}`} color={PROCEED_COL[r.wantsToProceed]||MUTE}/>
        <Badge label={`Fit: ${r.recommendedProgram||"—"}`} color="#7bb8e8"/>
        <Badge label={`Follow up: ${fmtDay(rec.followUpDate)}`} color={LIME_DIM}/>
      </div>
      <Panel title="Summary"><div style={{ fontSize:14, lineHeight:1.55 }}>{r.summary||"—"}</div></Panel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:13, marginTop:13 }}>
        <ListPanel title="What was discussed" items={r.keyPoints} icon={<CheckCircle2 size={15} color={LIME_DIM}/>} color={LIME_DIM}/>
        <ListPanel title="Doubts / objections" items={r.doubts} icon={<Target size={15} color="#e8b24b"/>} color="#e8b24b"/>
      </div>
      <Panel title="Next follow-up" style={{ marginTop:13 }}>
        <div style={{ fontSize:14, lineHeight:1.55 }}><b style={{color:LIME}}>{r.nextAction||"—"}</b></div>
        <div style={{ fontSize:13.5, color:MUTE, marginTop:6 }}>{r.followUpNote}</div>
        <div style={{ fontSize:12.5, color:MUTE, marginTop:8 }}>Suggested: <b style={{color:TXT}}>{fmtDay(rec.followUpDate)}</b> · sentiment: {r.sentiment||"—"}</div>
      </Panel>
      <details style={{ marginTop:14 }}>
        <summary style={{ fontSize:12.5, color:MUTE, cursor:"pointer" }}>Recording &amp; full transcript</summary>
        <audio controls src={`/api/real-calls/${rec.id}/audio`} style={{ width:"100%", marginTop:10 }}/>
        <pre style={{ whiteSpace:"pre-wrap", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:14, fontSize:13, color:TXT, fontFamily:"inherit", marginTop:10, maxHeight:240, overflow:"auto" }}>{rec.transcript}</pre>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Reports({ serif }) {
  const [calls, setCalls] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { (async()=>{ try { const r=await fetch("/api/real-calls"); const d=await r.json(); setCalls(d.calls||[]); } catch { setCalls([]); } })(); }, []);
  if (calls === null) return <div className="osf" style={{ padding:"60px 0", textAlign:"center", color:MUTE }}><Loader2 size={28} color={LIME} style={{ animation:"spin 1s linear infinite" }}/></div>;
  if (open) return (
    <div className="osf">
      <button onClick={()=>setOpen(null)} style={{ ...secondaryBtn, marginBottom:16, padding:"7px 13px", fontSize:12.5 }}><ArrowLeft size={14}/><span style={{marginLeft:6}}>All reports</span></button>
      <ReportView rec={open} serif={serif}/>
    </div>
  );
  const today = new Date().toDateString();
  const todayN = calls.filter(c=>new Date(c.ts).toDateString()===today).length;
  const hot = calls.filter(c=>c.report?.interestLevel==="Hot").length;
  const dueN = calls.filter(c=>c.followUpDate && !c.followUpDone && c.followUpDate <= Date.now()+86400000).length;
  return (
    <div className="osf">
      <h1 style={{ ...serif, fontSize:33, fontWeight:600, margin:"0 0 16px" }}>Reports &amp; pipeline</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12, marginBottom:22 }}>
        <Stat label="Total calls" value={calls.length}/>
        <Stat label="Contacted today" value={todayN}/>
        <Stat label="Hot leads" value={hot} color={LIME}/>
        <Stat label="Follow-ups due" value={dueN} color={dueN?"#e8b24b":MUTE}/>
      </div>
      {calls.length === 0 ? (
        <div style={{ color:MUTE, fontSize:14, background:PANEL, border:`1px dashed ${BORDER}`, borderRadius:14, padding:"28px", textAlign:"center" }}>
          No real calls logged yet. Record one from <b style={{color:TXT}}>Real Call</b> on the home screen.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {calls.map(c=>(
            <button key={c.id} onClick={()=>setOpen(c)} style={{ textAlign:"left", display:"flex", alignItems:"center", gap:12, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 15px", flexWrap:"wrap" }}>
              <span style={{ width:9, height:9, borderRadius:"50%", background: INTEREST_COL[c.report?.interestLevel]||MUTE, flexShrink:0 }}/>
              <span style={{ fontWeight:600, fontSize:14 }}>{c.learnerName}</span>
              <span style={{ fontSize:12, color:MUTE }}>{c.report?.recommendedProgram||"—"}</span>
              <Badge label={c.report?.wantsToProceed||"—"} color={PROCEED_COL[c.report?.wantsToProceed]||MUTE}/>
              <span style={{ marginLeft:"auto", fontSize:12, color:MUTE }}>follow up {fmtDay(c.followUpDate)}</span>
              <ChevronRight size={16} color={MUTE}/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const Stat = ({ label, value, color }) => (
  <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 16px" }}>
    <div style={{ fontSize:26, fontWeight:700, color: color||TXT, fontFamily:"'Fraunces',serif" }}>{value}</div>
    <div style={{ fontSize:11.5, color:MUTE, marginTop:2 }}>{label}</div>
  </div>
);

/* ------------------------------------------------------------------ */
function FollowUps({ serif, go }) {
  const [calls, setCalls] = useState(null);
  useEffect(() => { (async()=>{ try { const r=await fetch("/api/real-calls"); const d=await r.json(); setCalls(d.calls||[]); } catch { setCalls([]); } })(); }, []);
  if (calls === null) return <div className="osf" style={{ padding:"60px 0", textAlign:"center" }}><Loader2 size={28} color={LIME} style={{ animation:"spin 1s linear infinite" }}/></div>;
  const pending = calls.filter(c=>c.followUpDate && !c.followUpDone).sort((a,b)=>a.followUpDate-b.followUpDate);
  const now = Date.now();
  const bucket = d => d < now ? "Overdue" : d < now+86400000 ? "Today" : d < now+7*86400000 ? "This week" : "Later";
  const groups = ["Overdue","Today","This week","Later"];
  return (
    <div className="osf">
      <h1 style={{ ...serif, fontSize:33, fontWeight:600, margin:"0 0 16px" }}>Follow-ups</h1>
      {pending.length === 0 ? (
        <div style={{ color:MUTE, fontSize:14, background:PANEL, border:`1px dashed ${BORDER}`, borderRadius:14, padding:"28px", textAlign:"center" }}>
          No follow-ups scheduled yet. They appear here automatically after you log a real call.
        </div>
      ) : groups.map(g=>{
        const items = pending.filter(c=>bucket(c.followUpDate)===g);
        if (!items.length) return null;
        const gcol = g==="Overdue"?"#e87a6b":g==="Today"?LIME:MUTE;
        return (
          <div key={g} style={{ marginBottom:18 }}>
            <div style={{ fontSize:11.5, letterSpacing:1.2, textTransform:"uppercase", color:gcol, fontWeight:600, marginBottom:9 }}>{g}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {items.map(c=>(
                <div key={c.id} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 15px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>{c.learnerName}</span>
                    {c.phone && <span style={{ fontSize:12, color:MUTE }}>{c.phone}</span>}
                    <Badge label={c.report?.interestLevel||"—"} color={INTEREST_COL[c.report?.interestLevel]||MUTE}/>
                    <span style={{ marginLeft:"auto", fontSize:12.5, color:gcol, fontWeight:600 }}>{fmtDay(c.followUpDate)}</span>
                  </div>
                  <div style={{ fontSize:13.5, color:TXT, marginTop:7 }}><b style={{color:LIME}}>Next:</b> {c.report?.nextAction||"—"}</div>
                  {c.report?.followUpNote && <div style={{ fontSize:13, color:MUTE, marginTop:4 }}>{c.report.followUpNote}</div>}
                  <div style={{ fontSize:12.5, color:MUTE, marginTop:6, paddingTop:6, borderTop:`1px solid ${BORDER}` }}>Last time: {c.report?.summary||"—"}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
const Field = ({ label, children }) => (<label style={{ display:"block" }}><div style={{ fontSize:12, color:MUTE, marginBottom:6, fontWeight:500 }}>{label}</div>{children}</label>);
const inputStyle = { width:"100%", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"11px 14px", color:TXT, fontSize:14.5 };

/* ------------------------------------------------------------------ */
function Setup({ serif, mode, setMode, persona, setPersona, useCustom, setUseCustom, custom, setCustom, startCall, history, voiceWanted, setVoiceWanted, sttSupported, ttsSupported, repName, setRepName, difficulty, setDifficulty }) {
  const avg = history.length ? Math.round(history.reduce((a,h)=>a+h.overall,0)/history.length) : null;

  // Feature 1: streak calculation
  const streak = (() => {
    if (!history.length) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    let count = 0, check = new Date(today);
    while (true) {
      const dayStr = check.toDateString();
      if (history.some(h => new Date(h.date).toDateString() === dayStr)) {
        count++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  })();

  return (
    <div className="osf">
      <h1 style={{ ...serif, fontSize:37, fontWeight:600, margin:"0 0 6px", letterSpacing:-0.5 }}>Run a practice call.</h1>
      <p style={{ color:MUTE, margin:"0 0 24px", fontSize:15, maxWidth:560 }}>
        Talk to a realistic prospect out loud, then get an instant, evidence-based scorecard. Practice as many times as you want — no senior rep required.
      </p>

      {/* Feature 1: Rep name input */}
      <div style={{ marginBottom:18 }}>
        <Field label="Your name (for your scorecard)">
          <input value={repName} onChange={e=>{ setRepName(e.target.value); try { localStorage.setItem("sarafai_repname", e.target.value); } catch {} }}
            placeholder="e.g. Rahul" style={inputStyle}/>
        </Field>
      </div>

      {/* voice toggle */}
      <div style={{ background:PANEL, border:`1px solid ${voiceWanted?"rgba(194,238,69,0.4)":BORDER}`, borderRadius:14, padding:"14px 16px", marginBottom:22,
        display:"flex", alignItems:"center", gap:13 }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Mic size={19} color={LIME}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14.5 }}>Talk to the prospect out loud</div>
          <div style={{ fontSize:12, color:MUTE, marginTop:2 }}>
            {sttSupported ? "Uses your mic; the prospect speaks back. Best in Chrome or Edge — if your mic is blocked it falls back to typing." : "Voice input isn't supported in this browser — the prospect can still speak, but you'll type. Chrome or Edge recommended."}
          </div>
        </div>
        <Switch on={voiceWanted} onChange={()=>setVoiceWanted(v=>!v)} />
      </div>

      <SectionLabel>1 · Choose your mode</SectionLabel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12, marginBottom:26 }}>
        <ModeCard active={mode==="learner"} onClick={()=>setMode("learner")} icon={<Headphones size={18}/>} title="I sell · AI is the customer" sub="You're the salesperson. The AI plays the customer. You lead the call and get scored." serif={serif}/>
        <ModeCard active={mode==="agent"} onClick={()=>setMode("agent")} icon={<GraduationCap size={18}/>} title="AI sells · I'm the customer" sub="The AI is the salesperson and consults you. You play the customer and learn by listening." serif={serif}/>
      </div>

      {/* Feature 2: Difficulty pills */}
      <div style={{ marginBottom:22 }}>
        <SectionLabel>Difficulty</SectionLabel>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[
            { id:"easy", emoji:"🟢", label:"Easy", sub:"Warm & cooperative" },
            { id:"medium", emoji:"🟡", label:"Medium", sub:"Realistic mixed signals" },
            { id:"hard", emoji:"🔴", label:"Hard", sub:"Aggressive, tricky objections" },
          ].map(d=>(
            <button key={d.id} onClick={()=>setDifficulty(d.id)}
              style={{ display:"flex", alignItems:"center", gap:8, background: difficulty===d.id?"rgba(194,238,69,0.12)":PANEL,
                border:`1px solid ${difficulty===d.id?"rgba(194,238,69,0.5)":BORDER}`, borderRadius:30, padding:"9px 16px", fontSize:13.5, transition:"all .15s" }}>
              <span>{d.emoji}</span>
              <span style={{ fontWeight:600, color: difficulty===d.id?LIME:TXT }}>{d.label}</span>
              <span style={{ color:MUTE, fontSize:12 }}>— {d.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === "learner" && (
        <>
          <SectionLabel>2 · Pick who you're calling</SectionLabel>
          <p style={{ color:MUTE, fontSize:12.5, margin:"0 0 12px" }}>You only see what a rep would know going in. Their mood, real objection and true blocker stay hidden until your scorecard.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(216px,1fr))", gap:10, marginBottom:14 }}>
            {PERSONAS.map(p=>(<PersonaCard key={p.id} p={p} active={!useCustom && persona.id===p.id} onClick={()=>{ setUseCustom(false); setPersona(p); }} serif={serif}/>))}
            <button onClick={()=>{ setUseCustom(false); setPersona(PERSONAS[Math.floor(Math.random()*PERSONAS.length)]); }} style={chip(false)}>
              <Shuffle size={14} color={LIME}/> <span style={{marginLeft:7}}>Surprise me</span>
            </button>
          </div>
          <button onClick={()=>setUseCustom(u=>!u)} style={{ ...chip(useCustom), marginBottom: useCustom?10:0 }}>
            <Pencil size={14} color={useCustom?INK:LIME}/> <span style={{marginLeft:7}}>Write a custom prospect</span>
          </button>
          {useCustom && (
            <textarea value={custom} onChange={e=>setCustom(e.target.value)} rows={3}
              placeholder="e.g. A 33-year-old non-technical HR manager in Toronto, polite but very skeptical about online courses, worried it's too advanced for her..."
              style={{ width:"100%", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 14px", color:TXT, fontSize:14, resize:"vertical", marginTop:4 }} />
          )}
        </>
      )}

      <div style={{ marginTop:30, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <button onClick={startCall} style={primaryBtn}>
          {voiceWanted ? <Mic size={17}/> : <Phone size={17}/>} <span style={{marginLeft:8}}>{voiceWanted ? "Start voice call" : "Start the call"}</span>
        </button>
        {avg !== null && (
          <div style={{ fontSize:13, color:MUTE, display:"flex", alignItems:"center", gap:7 }}>
            <TrendingUp size={15} color={LIME_DIM}/> {history.length} past rep{history.length>1?"s":""} · avg score <b style={{color:TXT}}>{avg}</b>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
            <SectionLabel>Your recent reps</SectionLabel>
            {streak >= 2 && <span style={{ fontSize:13, color:"#e8b24b", fontWeight:600, marginLeft:8 }}>🔥 {streak} day streak</span>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {history.slice(0,5).map((h,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, fontSize:13, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:"9px 13px" }}>
                <span style={{ fontWeight:700, color: scoreColor(h.overall), width:30 }}>{h.overall}</span>
                <span style={{ color:TXT }}>{h.persona}</span>
                <span style={{ color:MUTE, fontSize:11.5 }}>{h.mode==="learner"?"practice":"demo"}</span>
                {h.correctRouting ? <CheckCircle2 size={14} color={LIME_DIM}/> : <XCircle size={14} color="#e87a6b"/>}
                <span style={{ marginLeft:"auto", color:MUTE, fontSize:11.5 }}>{new Date(h.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function CallView({ serif, mode, persona, messages, busy, input, setInput, send, seconds, endCall, err, scrollRef, voice, letThemOpen, callStage, totalStages, hint, setHint, mood }) {
  const overtime = seconds > 420;
  const youAre = mode==="learner" ? "the salesperson" : "the customer";
  const otherName = mode==="learner" ? persona.name : "the salesperson";
  const noOneSpoke = messages.length === 0 && !busy;
  const STAGE_NAMES = ["Opening", "Discovery", "Routing", "Value Pitch", "Objection", "Close"];
  const MOOD_CONFIG = {
    interested: { emoji:"😊", label:"Warming up", color:LIME },
    hot: { emoji:"😍", label:"Ready to close!", color:"#c2ee45" },
    cold: { emoji:"😤", label:"Losing them", color:"#e87a6b" },
    neutral: { emoji:"😐", label:"Neutral", color:MUTE },
  };
  const moodInfo = MOOD_CONFIG[mood] || MOOD_CONFIG.neutral;
  return (
    <div className="osf">
      <div style={{ display:"flex", alignItems:"center", gap:12, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"12px 14px", marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <User size={18} color={LIME}/>
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14.5 }}>{mode==="learner" ? persona.name : "OutSkill salesperson (AI)"}</div>
          <div style={{ fontSize:11.5, color:MUTE, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mode==="learner" ? persona.lead : "You're the customer — respond naturally."}</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          {/* Feature 5: Mood indicator */}
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:moodInfo.color, background:`${moodInfo.color}18`, border:`1px solid ${moodInfo.color}44`, borderRadius:20, padding:"4px 10px", fontWeight:500 }}>
            {moodInfo.emoji} {moodInfo.label}
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color: overtime?"#e8b24b":MUTE, fontVariantNumeric:"tabular-nums" }}>
            <Clock size={14}/> {fmtTime(seconds)} {overtime && <span style={{fontSize:10.5}}>· wrap up</span>}
          </div>
          <button onClick={endCall} style={endBtn}><PhoneOff size={15}/> <span style={{marginLeft:7}}>End &amp; get coaching</span></button>
        </div>
      </div>

      <div style={{ fontSize:11.5, color:MUTE, margin:"0 0 10px", display:"flex", alignItems:"center", gap:6 }}>
        <span style={{width:7,height:7,borderRadius:"50%",background:LIME,boxShadow:`0 0 8px ${LIME}`}}/>
        Call connected · you are <b style={{color:TXT, margin:"0 3px"}}>{youAre}</b>. Either side can speak first.
      </div>

      {/* Feature 3: Stage progress bar */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
          <span style={{ fontSize:11, color:MUTE }}>{STAGE_NAMES[callStage]}</span>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {STAGE_NAMES.map((name, i) => (
            <div key={i} title={name} style={{ flex:1, height:5, borderRadius:4,
              background: i <= callStage ? LIME : "rgba(255,255,255,0.09)",
              transition:"background .3s ease" }}/>
          ))}
        </div>
      </div>

      {/* Feature 4: Hint banner */}
      {hint && (
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(232,178,75,0.08)", border:"1px solid rgba(232,178,75,0.35)", borderRadius:10, padding:"9px 13px", marginBottom:10, fontSize:12.5, color:"#f0d29a" }}>
          <span style={{ flex:1 }}>{hint}</span>
          <button onClick={()=>setHint("")} style={{ background:"none", border:"none", color:"#f0d29a", fontSize:15, lineHeight:1, padding:"0 2px", opacity:0.7 }}>✕</button>
        </div>
      )}

      {noOneSpoke && (
        <div style={{ background:PANEL, border:`1px dashed ${BORDER}`, borderRadius:12, padding:"12px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:12.5, color:MUTE }}>Go ahead and open the call — or let {otherName} start.</span>
          <button onClick={letThemOpen} style={{ ...secondaryBtn, padding:"8px 14px", fontSize:13, marginLeft:"auto" }}>
            <Phone size={14}/><span style={{marginLeft:7}}>Let {otherName} open</span>
          </button>
        </div>
      )}

      <div ref={scrollRef} className="oscroll" style={{ height:"min(46vh, 380px)", overflowY:"auto", padding:"6px 2px 6px 0", display:"flex", flexDirection:"column", gap:12 }}>
        {messages.map((m,i)=>(<Bubble key={i} m={m} mode={mode} persona={persona}/>))}
        {busy && (
          <div style={{ alignSelf:"flex-start", maxWidth:"82%" }}>
            <Who label={mode==="learner"?persona.name:"OutSkill Rep"}/>
            <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:"4px 16px 16px 16px", padding:"12px 16px" }}>
              <span className="osd"/><span className="osd"/><span className="osd"/>
            </div>
          </div>
        )}
      </div>

      {err && <div style={errStyle}>{err}</div>}

      {/* Voice panel — only shown when voice is enabled */}
      {voice.on && <VoiceDock voice={voice} mode={mode} persona={persona} input={input} setInput={setInput} send={send} busy={busy}/>}

      {/* Text input — always visible so the call works even if voice fails */}
      <div style={{ marginTop: voice.on ? 10 : 14 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2}
            onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }}
            placeholder={mode==="learner" ? "Type what you'd say… (Enter to send)" : "Reply as the learner… (Enter to send)"}
            style={{ flex:1, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"13px 15px", color:TXT, fontSize:14.5, resize:"none", maxHeight:140, lineHeight:1.4 }}/>
          <button onClick={send} disabled={busy || !input.trim()} style={{ ...sendBtn, opacity: busy||!input.trim()?0.45:1 }}><Send size={17}/></button>
        </div>
        <div style={{ display:"flex", gap:14, marginTop:8, alignItems:"center" }}>
          {!voice.on && voice.sttSupported && !voice.blocked && (
            <button onClick={voice.enable} style={{ ...linkBtn }}><Mic size={13}/><span style={{marginLeft:6}}>Enable voice</span></button>
          )}
          {voice.on && (
            <button onClick={voice.disable} style={{ ...linkBtn }}><MicOff size={13}/><span style={{marginLeft:6}}>Disable voice</span></button>
          )}
          {voice.blocked && <span style={{ fontSize:12, color:"#e8b24b" }}>Mic blocked — using text mode</span>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function VoiceDock({ voice, mode, persona, input, setInput, send, busy }) {
  const { listening, speaking, blocked, interim, handsFree, setHandsFree, onMicTap, enVoices, voiceURI, setVoiceURI, rate, setRate } = voice;
  const name = mode==="learner" ? persona.name : "the rep";

  let state = "idle", label = "Tap to talk", Icon = Mic, col = LIME;
  if (blocked) { state="blocked"; label="Mic unavailable — type below"; Icon=MicOff; col="#e8b24b"; }
  else if (busy) { state="thinking"; label="Thinking…"; }
  else if (speaking) { state="speaking"; label=`${name} is speaking — tap to jump in`; Icon=AudioLines; }
  else if (listening) { state="listening"; label="Listening… tap when you're done"; }

  return (
    <div style={{ marginTop:16 }}>
      {/* orb */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0 4px" }}>
        <button onClick={onMicTap} disabled={blocked || busy}
          style={{
            width:96, height:96, borderRadius:"50%", border:"none", display:"flex", alignItems:"center", justifyContent:"center",
            background: state==="listening" ? "rgba(194,238,69,0.16)" : state==="speaking" ? "rgba(194,238,69,0.10)" : PANEL,
            boxShadow: state==="listening" ? `0 0 0 0 rgba(194,238,69,.45)` : "none",
            animation: state==="listening" ? "pulse 1.6s infinite" : "none",
            border: `1.5px solid ${state==="idle" ? "rgba(194,238,69,0.5)" : state==="blocked" ? "rgba(232,178,75,0.5)" : "rgba(194,238,69,0.7)"}`,
            transition:"all .2s ease", opacity: blocked||busy?0.7:1,
          }}>
          {state==="thinking"
            ? <Loader2 size={30} color={LIME} style={{ animation:"spin 1s linear infinite" }}/>
            : state==="speaking"
              ? <div style={{ display:"flex", alignItems:"center", gap:4, height:34 }}>
                  {[0,1,2,3].map(i=>(<span key={i} style={{ width:5, height:30, borderRadius:3, background:LIME, transformOrigin:"center", animation:`bob ${0.6+i*0.12}s ease-in-out infinite`, animationDelay:`${i*0.08}s` }}/>))}
                </div>
              : <Icon size={32} color={col}/>}
        </button>
        <div style={{ fontSize:13, color: state==="blocked"?"#e8b24b":MUTE, marginTop:14, minHeight:18, textAlign:"center" }}>{label}</div>
        {/* live transcript */}
        {(listening || interim) && !blocked && (
          <div style={{ marginTop:8, fontSize:14.5, color:TXT, textAlign:"center", maxWidth:520, minHeight:20, fontStyle: interim?"normal":"italic" }}>
            {interim || "…"}
          </div>
        )}
      </div>

      {/* controls */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:18, flexWrap:"wrap", marginTop:10 }}>
        {!blocked && (
          <button onClick={()=>setHandsFree(!handsFree)} style={{ ...linkBtn, color: handsFree?LIME:MUTE }}>
            <span style={{ width:9, height:9, borderRadius:"50%", background: handsFree?LIME:MUTE, display:"inline-block", marginRight:7 }}/>
            Hands-free {handsFree?"on":"off"}
          </button>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:MUTE }}>
          <AudioLines size={14}/> Speed
          <select value={rate} onChange={e=>setRate(Number(e.target.value))}>
            <option value={0.9}>0.9× slow</option>
            <option value={1}>1× normal</option>
            <option value={1.15}>1.15×</option>
            <option value={1.3}>1.3× fast</option>
            <option value={1.5}>1.5× faster</option>
            <option value={1.75}>1.75× very fast</option>
          </select>
        </label>
        {enVoices.length > 0 && (
          <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:MUTE }}>
            <Volume2 size={14}/> Voice
            <select value={voiceURI} onChange={e=>setVoiceURI(e.target.value)}>
              <option value="">Auto ({persona.ttsLang})</option>
              {enVoices.map(v=>(<option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>))}
            </select>
          </label>
        )}
        <button onClick={voice.disable} style={linkBtn}><Keyboard size={14}/><span style={{marginLeft:6}}>Type instead</span></button>
      </div>

      {/* blocked → text fallback */}
      {blocked && (
        <>
          <div style={{ ...errStyle, background:"rgba(232,178,75,0.08)", borderColor:"rgba(232,178,75,0.4)", color:"#f0d29a", marginTop:14 }}>
            Voice unavailable on this connection — <b>just type your reply below</b>. The prospect will still speak their responses aloud. This happens when Chrome can't reach Google's speech servers; typing works fine and is just as good for practice.
          </div>
          <div style={{ display:"flex", gap:10, marginTop:12, alignItems:"flex-end" }}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} rows={1}
              onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }}
              placeholder="Type your reply…"
              style={{ flex:1, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"13px 15px", color:TXT, fontSize:14.5, resize:"none", maxHeight:140, lineHeight:1.4 }}/>
            <button onClick={send} disabled={busy || !input.trim()} style={{ ...sendBtn, opacity: busy||!input.trim()?0.45:1 }}><Send size={17}/></button>
          </div>
        </>
      )}
    </div>
  );
}

function Bubble({ m, mode, persona }) {
  const mine = m.role === "user";
  const label = mode==="learner" ? (mine ? "You (rep)" : persona.name) : (mine ? "You (learner)" : "OutSkill Rep");
  return (
    <div className="osf" style={{ alignSelf: mine?"flex-end":"flex-start", maxWidth:"82%" }}>
      <Who label={label} mine={mine}/>
      <div style={{ background: mine ? "rgba(194,238,69,0.13)" : PANEL, border:`1px solid ${mine?"rgba(194,238,69,0.28)":BORDER}`,
        borderRadius: mine?"16px 4px 16px 16px":"4px 16px 16px 16px", padding:"11px 15px", fontSize:14.5, lineHeight:1.5, color: mine?"#eef6d6":TXT, whiteSpace:"pre-wrap" }}>
        {m.content}
      </div>
    </div>
  );
}
const Who = ({ label, mine }) => (<div style={{ fontSize:11, color:MUTE, margin:"0 0 4px", textAlign: mine?"right":"left", paddingLeft:mine?0:4, paddingRight:mine?4:0 }}>{label}</div>);

/* ------------------------------------------------------------------ */
function Feedback({ serif, mode, persona, card, cardRaw, grading, err, reset, again, duration, useCustom, repName }) {
  if (grading) {
    return (
      <div className="osf" style={{ textAlign:"center", padding:"70px 0" }}>
        <Loader2 size={34} color={LIME} style={{ animation:"spin 1s linear infinite" }} />
        <div style={{ ...serif, fontSize:22, marginTop:18 }}>Your coach is reviewing the call…</div>
        <div style={{ color:MUTE, fontSize:14, marginTop:6 }}>Scoring discovery, routing, objection handling and the close.</div>
      </div>
    );
  }
  if (err && !card && !cardRaw) {
    return (<div className="osf" style={{ padding:"50px 0", textAlign:"center" }}>
      <div style={errStyle}>{err}</div>
      <button onClick={reset} style={{ ...secondaryBtn, marginTop:18 }}><ArrowLeft size={15}/><span style={{marginLeft:7}}>Back</span></button>
    </div>);
  }
  if (!card && cardRaw) {
    // Strip any JSON/code and show plain readable text
    const readable = cardRaw
      .replace(/```json[\s\S]*?```/gi, "")
      .replace(/```[\s\S]*?```/gi, "")
      .replace(/[{}\[\]"]/g, "")
      .replace(/,\s*\n/g, "\n")
      .replace(/:\s*/g, ": ")
      .trim();
    return (<div className="osf">
      <h2 style={{...serif, fontSize:26, marginBottom:16}}>Your coaching feedback</h2>
      <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:20, fontSize:14, color:TXT, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{readable}</div>
      <FeedbackFooter reset={reset} again={again}/>
    </div>);
  }
  if (!card) return null;
  const routedRight = card.correctRouting, isDemo = mode === "agent";
  const score = card.overall;
  const scoreColor = score >= 80 ? LIME : score >= 60 ? "#e8d24b" : "#e87a6b";
  return (
    <div className="osf">
      {/* ── Hero scorecard header ── */}
      <div style={{ background:`linear-gradient(135deg, rgba(194,238,69,0.07) 0%, rgba(10,12,8,0) 60%)`, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 24px 20px", marginBottom:18, display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
        <Ring value={score}/>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>{isDemo ? "Ideal-call breakdown" : (repName ? `${repName}'s coaching` : "Your call scorecard")}</div>
          <h2 style={{ ...serif, fontSize:30, fontWeight:600, margin:"0 0 12px", color:scoreColor }}>{scoreVerdict(score)}</h2>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Pill ok={routedRight}>{routedRight ? <CheckCircle2 size={13}/> : <XCircle size={13}/>}<span style={{marginLeft:5}}>Routed → {card.recommendedProgram}{routedRight?" ✓":" ✗ wrong track"}</span></Pill>
            <Pill neutral><Clock size={12}/><span style={{marginLeft:5}}>{duration}</span></Pill>
          </div>
        </div>
        {/* mini score bar across the top */}
        <div style={{ width:"100%", height:5, borderRadius:4, background:"rgba(255,255,255,0.07)", overflow:"hidden", marginTop:4 }}>
          <div style={{ height:"100%", width:`${score}%`, background:scoreColor, borderRadius:4, transition:"width .8s ease" }}/>
        </div>
      </div>

      {card.flags && card.flags.length > 0 && (
        <div style={{ background:"rgba(232,122,107,0.08)", border:"1px solid rgba(232,122,107,0.4)", borderRadius:14, padding:"14px 18px", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#f0a594", fontWeight:700, fontSize:13.5, marginBottom:8 }}><AlertTriangle size={16}/> Compliance / Critical Flags</div>
          {card.flags.map((f,i)=>(<div key={i} style={{ fontSize:13, color:"#f3cabf", marginTop:5, paddingLeft:8, borderLeft:`2px solid rgba(232,122,107,0.5)` }}>• {f}</div>))}
        </div>
      )}

      <Panel title="Category breakdown">
        {card.categories.map((c,i)=>{
          const pct = c.score/c.max;
          return (
            <div key={i} style={{ marginBottom:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                <span style={{ fontWeight:500 }}>{c.name}</span>
                <span style={{ color:MUTE, minWidth:48, textAlign:"right" }}><b style={{ color:barColor(pct), fontSize:15 }}>{c.score}</b><span style={{fontSize:11}}>/{c.max}</span></span>
              </div>
              <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct*100}%`, background:barColor(pct), borderRadius:6, transition:"width .7s ease" }}/>
              </div>
            </div>
          );
        })}
      </Panel>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:14, marginTop:14 }}>
        <ListPanel title="✓ What you did well" items={card.strengths} icon={<CheckCircle2 size={15} color={LIME_DIM}/>} color={LIME_DIM}/>
        <ListPanel title="✗ Where you lost points" items={card.lostPoints} icon={<Target size={15} color="#e8b24b"/>} color="#e8b24b"/>
        <ListPanel title="◎ Missed opportunities" items={card.missed} icon={<Sparkles size={15} color="#7bb8e8"/>} color="#7bb8e8"/>
        <ListPanel title="💬 Say this next time" items={card.sayNextTime} icon={<ChevronRight size={15} color={LIME}/>} color={LIME} quote/>
      </div>

      {card.behavioral && (
        <Panel title="Behavioral read" style={{ marginTop:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, fontSize:13.5 }}>
            <Meta k="Pace" v={card.behavioral.pace}/>
            <Meta k="Tone" v={card.behavioral.tone}/>
            <Meta k="Talk-time balance" v={card.behavioral.talkTime}/>
            <Meta k="Red flags" v={card.behavioral.redFlags}/>
          </div>
        </Panel>
      )}

      {!isDemo && !useCustom && (
        <Panel title="Who you were really talking to" style={{ marginTop:14 }}>
          <div style={{ fontSize:13.5, lineHeight:1.65 }}>
            <div style={{ marginBottom:8 }}><Tag>{persona.mood} mood</Tag> <Tag>{persona.route} track</Tag></div>
            <div><span style={{color:MUTE}}>Stated objection: </span><b style={{color:TXT}}>{persona.stated}</b></div>
            <div style={{ marginTop:6 }}><span style={{color:MUTE}}>Their true blocker: </span><b style={{color:LIME_DIM}}>{persona.blocker}</b></div>
          </div>
        </Panel>
      )}

      <FeedbackFooter reset={reset} again={again}/>
    </div>
  );
}
function FeedbackFooter({ reset, again }) {
  return (
    <div style={{ display:"flex", gap:12, marginTop:24, flexWrap:"wrap" }}>
      <button onClick={again} style={primaryBtn}><RotateCcw size={16}/><span style={{marginLeft:8}}>Run this persona again</span></button>
      <button onClick={reset} style={secondaryBtn}><ArrowLeft size={15}/><span style={{marginLeft:7}}>New scenario</span></button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const SectionLabel = ({ children }) => (<div style={{ fontSize:11.5, letterSpacing:1.4, textTransform:"uppercase", color:MUTE, margin:"0 0 12px", fontWeight:600 }}>{children}</div>);

function Switch({ on, onChange }) {
  return (
    <button onClick={onChange} style={{ width:46, height:26, borderRadius:20, border:"none", background: on?LIME:"rgba(255,255,255,0.12)", position:"relative", flexShrink:0, transition:"background .2s" }}>
      <span style={{ position:"absolute", top:3, left: on?23:3, width:20, height:20, borderRadius:"50%", background: on?INK:"#cfd3c6", transition:"left .2s" }}/>
    </button>
  );
}
function ModeCard({ active, onClick, icon, title, sub, serif }) {
  return (
    <button onClick={onClick} style={{ textAlign:"left", background: active?"rgba(194,238,69,0.10)":PANEL, border:`1px solid ${active?"rgba(194,238,69,0.5)":BORDER}`, borderRadius:16, padding:"16px 17px", transition:"all .18s ease" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}><span style={{ color: active?LIME:TXT }}>{icon}</span><span style={{ ...serif, fontSize:17, fontWeight:600, color: active?LIME:TXT }}>{title}</span></div>
      <div style={{ fontSize:13, color:MUTE, lineHeight:1.45 }}>{sub}</div>
    </button>
  );
}
function PersonaCard({ p, active, onClick, serif }) {
  return (
    <button onClick={onClick} style={{ textAlign:"left", background: active?"rgba(194,238,69,0.10)":PANEL, border:`1px solid ${active?"rgba(194,238,69,0.5)":BORDER}`, borderRadius:13, padding:"12px 13px", transition:"all .15s ease" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ ...serif, fontSize:15.5, fontWeight:600, color: active?LIME:TXT }}>{p.name}</span>
        <span style={{ marginLeft:"auto", fontSize:9.5, letterSpacing:.4, textTransform:"uppercase", color: p.route==="Engineering"?"#7bb8e8":LIME_DIM, border:`1px solid ${p.route==="Engineering"?"rgba(123,184,232,.4)":"rgba(159,194,58,.4)"}`, borderRadius:20, padding:"2px 7px" }}>{p.route==="Engineering"?"Eng":"Gen"}</span>
      </div>
      <div style={{ fontSize:12, color:MUTE, marginTop:3 }}>{p.tag}</div>
    </button>
  );
}
function Ring({ value }) {
  const r=42, c=2*Math.PI*r, off=c-(value/100)*c, col=scoreColor(value);
  return (
    <div style={{ position:"relative", width:104, height:104, flexShrink:0 }}>
      <svg width="104" height="104" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"/>
        <circle cx="52" cy="52" r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition:"stroke-dashoffset 1s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:30, fontWeight:700, color:col, lineHeight:1, fontFamily:"'Fraunces',serif" }}>{value}</span>
        <span style={{ fontSize:10.5, color:MUTE }}>/ 100</span>
      </div>
    </div>
  );
}
function Panel({ title, children, style }) {
  return (<div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"15px 17px", ...style }}>
    <div style={{ fontSize:11.5, letterSpacing:1.2, textTransform:"uppercase", color:MUTE, fontWeight:600, marginBottom:13 }}>{title}</div>{children}
  </div>);
}
function ListPanel({ title, items, icon, color, quote }) {
  return (<div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"15px 17px" }}>
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:11 }}>{icon}<span style={{ fontSize:13.5, fontWeight:600, color }}>{title}</span></div>
    <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
      {(items||[]).map((it,i)=>(<div key={i} style={{ fontSize:13.3, lineHeight:1.5, color: quote?"#eef6d6":TXT, paddingLeft: quote?11:0, borderLeft: quote?`2px solid ${LIME}`:"none", fontStyle: quote?"italic":"normal" }}>{quote ? `"${it}"` : it}</div>))}
      {(!items || items.length===0) && <div style={{ fontSize:13, color:MUTE }}>—</div>}
    </div>
  </div>);
}
const Meta = ({ k, v }) => (<div><div style={{ fontSize:11, color:MUTE, textTransform:"uppercase", letterSpacing:.6, marginBottom:3 }}>{k}</div><div style={{ fontSize:13.5 }}>{v || "—"}</div></div>);
const Pill = ({ children, ok, neutral }) => {
  const c = neutral ? MUTE : ok ? LIME_DIM : "#e87a6b";
  const bg = neutral ? "rgba(255,255,255,0.05)" : ok ? "rgba(159,194,58,0.12)" : "rgba(232,122,107,0.12)";
  return (<span style={{ display:"inline-flex", alignItems:"center", fontSize:12.5, color:c, background:bg, border:`1px solid ${c}40`, borderRadius:30, padding:"5px 11px", fontWeight:500 }}>{children}</span>);
};
const Tag = ({ children }) => (<span style={{ display:"inline-block", fontSize:11, color:MUTE, background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:20, padding:"3px 9px", marginRight:6 }}>{children}</span>);

/* ------------------------------------------------------------------ */
const primaryBtn = { display:"inline-flex", alignItems:"center", background:LIME, color:INK, border:"none", borderRadius:30, padding:"12px 22px", fontSize:15, fontWeight:600 };
const secondaryBtn = { display:"inline-flex", alignItems:"center", background:"transparent", color:TXT, border:`1px solid ${BORDER}`, borderRadius:30, padding:"11px 18px", fontSize:14, fontWeight:500 };
const endBtn = { display:"inline-flex", alignItems:"center", background:"rgba(232,122,107,0.14)", color:"#f0a594", border:"1px solid rgba(232,122,107,0.4)", borderRadius:30, padding:"9px 15px", fontSize:13, fontWeight:600 };
const sendBtn = { display:"inline-flex", alignItems:"center", justifyContent:"center", background:LIME, color:INK, border:"none", borderRadius:13, width:50, height:48, flexShrink:0 };
const linkBtn = { display:"inline-flex", alignItems:"center", background:"transparent", color:MUTE, border:"none", fontSize:12.5, padding:"4px 2px" };
const errStyle = { background:"rgba(232,122,107,0.1)", border:"1px solid rgba(232,122,107,0.4)", color:"#f3cabf", borderRadius:12, padding:"11px 14px", fontSize:13.5, marginTop:12 };
const chip = active => ({ display:"inline-flex", alignItems:"center", background: active?LIME:PANEL, color: active?INK:TXT, border:`1px solid ${active?LIME:BORDER}`, borderRadius:12, padding:"11px 13px", fontSize:13.5, fontWeight:500 });

function scoreColor(v){ return v>=80?LIME:v>=60?"#e8d24b":v>=40?"#e8a94b":"#e87a6b"; }
function barColor(r){ return r>=0.8?LIME:r>=0.55?"#d8e84b":r>=0.35?"#e8a94b":"#e87a6b"; }
function scoreVerdict(v){ return v>=85?"Strong call.":v>=70?"Solid, with room to sharpen.":v>=50?"Some good instincts — key gaps to fix.":"Let's rebuild the fundamentals."; }
