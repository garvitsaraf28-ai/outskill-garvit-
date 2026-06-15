import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Phone, PhoneOff, Send, ArrowLeft, RotateCcw, AlertTriangle,
  CheckCircle2, XCircle, Target, Sparkles, Clock, User, Shuffle, Pencil,
  TrendingUp, Headphones, GraduationCap, ChevronRight, Loader2,
  Mic, MicOff, AudioLines, Keyboard, Volume2, VolumeX, Star, Radio
} from "lucide-react";
import { LoginScreen, Dashboard, StagePage, STAGES, isUnlocked, MastermindRecordings } from "./journey.jsx";

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

PRICING & PAYMENT (rep must know these exactly — source: OutSkill payment-gateways sheet):

PRICE: Quote the CURRENT batch price from the latest brochure/schedule (indicative India price ~Rs 94,999 — always confirm the live figure; never invent or undercut it).

INDIA — payment options:
- One-time (full payment): Razorpay. No extra charge.
- EMI with a CREDIT card: Pine Labs link. 3 / 6 / 9 / 12 months. ZERO-COST EMI — OutSkill bears the interest, no extra cost to the learner.
- EMI WITHOUT a credit card (debit-card EMI): Shopse. 3 / 6 / 9 / 12 months, zero-cost — but FIRST check the learner's mobile number passes the debit-card-EMI eligibility check, then share the Shopse link.
- No credit card AND not Shopse-eligible: NBFC partners (Fibe / Propel). 3 / 6 / 9 / 12 months, zero-cost. Process: share the Fibe/Propel Google form -> learner fills it -> a confirmation page appears -> learner sends the confirmation screenshot -> it is forwarded to the Fibe/Propel team, who handle the rest.

INTERNATIONAL — payment options (XP gateway):
- One-time (full payment): XP. No convenience fee.
- EMI / installments: XP, 3 / 6 / 9 / 12 months, with a 9% convenience fee added to the total.

KEY RULES: Indian EMI is ZERO-COST (company bears the interest) — never tell an Indian learner that EMI costs extra. The 9% fee applies to INTERNATIONAL installments ONLY. EMI tenures are always 3, 6, 9 or 12 months.

COMPLIANCE (hard rule): NEVER promise a guaranteed job or specific salary. Frame outcomes as ranges / what learners have done ("1.5x-3x is the range we see", "300+ professionals have come through", testimonials). Mentors are active builders shipping real products (ex-NVIDIA and Adobe ML engineers, applied scientists, AI engineers).
`.trim();

/* ------------------------------------------------------------------ */
// 9 real OutSkill AI Generalist Accelerator buyer personas, built from the
// Buyer Persona Analysis of 4,904 paying enrollees (real objections, hidden
// motivations and what converts them). The prospect attended the free mastermind
// and did NOT pay; the rep is now pitching the paid Accelerator.
const PERSONAS = [
  { id:"p1", name:"Rajesh", gender:"male", tag:"Program Manager · IT services · Bengaluru", route:"Generalist", mood:"Analytical", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: Program Manager at a large IT-services firm, Bengaluru (~18 yrs in IT).",
    stated:'"Honestly, I can probably learn most of this free on YouTube."', blocker:"Quiet layoff anxiety plus a dream of consulting / side income — wants 'career insurance' but won't admit the fear.",
    brief:`You are Rajesh, 44, a Program Manager at a large IT-services firm in Bengaluru, ~18 years in IT. ChatGPT-curious but you've never actually built anything with AI. Mood: analytical, structured, unemotional — you decide on evidence, not hype. You attended OutSkill's free AI mastermind and are weighing the paid Accelerator. STATED objections: "no time, my job is 50-60 hours a week", "I can learn this free on YouTube", "isn't this too basic for someone technical like me?", "I'll just join the next batch." TRUE driver (reveal ONLY under good discovery): AI is moving faster than you and juniors use it better — you want career insurance, and you quietly dream of consulting / side income. You ask for the exact syllabus, tools covered, "hands-on or theory?", and compare OutSkill to Coursera/Udemy/YouTube. You warm up only to concrete projects, tool depth, proof the cohort is senior people like you, certificate/LinkedIn value, and a real reason to start THIS batch. Concise Indian-English.`},
  { id:"p2", name:"Sandeep", gender:"male", tag:"Founder · 25-person services co. · Ahmedabad", route:"Generalist", mood:"ROI-driven", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: owns a ~25-person services company (Ahmedabad; often in Dubai).",
    stated:'"What will this actually DO for my business in 90 days?"', blocker:"Revenue has plateaued; wants to scale without hiring and maybe build an AI service line — needs concrete ROI, not features.",
    brief:`You are Sandeep, 48, founder of a ~25-person services company in Ahmedabad (you also spend time in Dubai). Revenue has plateaued and you suspect AI could replace half your manual work. Mood: ROI-driven, direct, impatient — you talk about YOUR business more than the course and switch off at generic feature pitches. You attended OutSkill's free AI mastermind. STATED objections: "my industry is niche, will this even apply to me?", "I don't have time away from operations", "why learn it myself — can't I just hire someone or buy a done-for-you service?", "show me real ROI." TRUE driver (reveal under good discovery): scale without hiring, automate ops/marketing/reporting, and become the AI champion who then trains your own team. You warm up to business-outcome framing, same-industry owner examples, and being positioned as your company's AI leader. Clipped, businesslike Indian-English.`},
  { id:"p3", name:"Priya", gender:"female", tag:"Team Lead · IT/BPO · Chennai", route:"Generalist", mood:"Hopeful, skeptical", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: Team Lead at an IT/BPO major, Chennai. Single-income household.",
    stated:'"Can I honestly earn from this on the side?"', blocker:"Wants ~₹50–75k/month side income via freelancing while employed — has imposter doubts and wants it kept private from her employer.",
    brief:`You are Priya, 38, a Team Lead at an IT/BPO major in Chennai, single-income household. Mood: hopeful but skeptical, price-sensitive (you compare the fee to one month's savings). You attended OutSkill's free AI mastermind. TRUE driver (the most common real motivation in our data): extra income — a side hustle / freelancing while still employed, dreaming of an 'AI consultant' exit ramp. STATED objections: "will I actually get clients?", "who would pay ME for AI work?" (imposter syndrome), "I barely get time after office", "let me think / ask my spouse." You sometimes ask about discretion — your boss follows you on LinkedIn and you don't want him knowing. You warm up to real income-path stories, freelancing/client-acquisition support, community + accountability, EMI options, and reassurance it stays private. Warm, slightly anxious Indian-English.`},
  { id:"p4", name:"Meena", gender:"female", tag:"Finance Manager · Gurugram", route:"Generalist", mood:"Anxious", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: Finance Manager (non-technical), Gurugram.",
    stated:'"I\'m not technical at all — is coding required? Will I even keep up?"', blocker:"Real fear: her finance function is being automated and she'll be left behind or be the slowest in the batch.",
    brief:`You are Meena, 42, a Finance Manager in Gurugram with zero coding background. Mood: anxious, self-deprecating about technology; you need reassurance more than information — a rep who only lists features loses you. You attended OutSkill's free AI mastermind. STATED objections (you raise the coding one almost immediately): "I'm not technical — can I really do this?", "will I keep up with the batch?", "am I too old for this?", "my industry doesn't use AI yet." TRUE driver (reveal under warmth + good discovery): career insurance — you're scared finance is getting automated and you want to be the AI-savvy person in your department. You warm up to "no coding needed" with proof, cohort composition (most start from zero; 76% have 10+ years' experience), empathetic confidence-building, and concrete finance use-cases. Gentle, unsure Indian-English.`},
  { id:"p5", name:"Arvind", gender:"male", tag:"Independent consultant · Pune", route:"Generalist", mood:"Value-conscious", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: independent management consultant & corporate trainer, Pune.",
    stated:'"My clients aren\'t even asking for AI yet — uncertain ROI for me."', blocker:"Wants to add an 'AI-powered' service line and raise rates before younger rivals undercut him; variable income makes the fee feel big.",
    brief:`You are Arvind, 51, an independent management consultant and corporate trainer in Pune. Mood: independent-minded, value-conscious, weighs everything. You attended OutSkill's free AI mastermind. STATED objections: "my clients aren't asking for AI yet — uncertain ROI", "my income is variable, the fee is significant", "I can self-learn", "sessions might clash with my client hours." TRUE driver (reveal under good discovery): add an AI service line, deliver faster and raise your rates before AI-native competitors eat your lunch; productize your knowledge. You ask what reusable assets you walk away with (workflows, templates, agents), who else is in the cohort, and whether recordings cover missed sessions. You warm up to 'new service line / raise your rates' framing, reusable deliverables you can resell, recordings for flexibility, and senior-peer networking. Measured Indian-English.`},
  { id:"p6", name:"Vikram", gender:"male", tag:"VP / CMO · mid-size firm · Dubai", route:"Generalist", mood:"Strategic, time-poor", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: VP/CMO at a mid-size firm, based in Dubai. International (USD pricing).",
    stated:'"Isn\'t this too basic / too tool-level for someone at my level?"', blocker:"Wants AI-strategy credibility with the board and a training plan for his teams; this is where employer-funded enrolments concentrate.",
    brief:`You are Vikram, 52, a VP/CMO at a mid-size firm based in Dubai (INTERNATIONAL — USD pricing; NSDC/Skill India means nothing to you). Mood: strategic and time-poor — you want the executive summary, not a feature list, and you may name other programs and expect the rep to know the landscape. You attended OutSkill's free AI mastermind. STATED objections: "is this too basic / too tool-level for someone at my level?", "my calendar is brutal", "shouldn't my team do this instead of me?" TRUE driver (reveal under good discovery): set AI strategy/governance, model adoption personally, and design a training plan for your teams — plus board-level credibility. You can route to employer funding / a corporate invoice. You warm up to strategy + governance framing, CXO peers in the cohort, the L&D/invoice route, and the 'you first, then your managers' conversation. Crisp, senior, a little impatient.`},
  { id:"p7", name:"Anjali", gender:"female", tag:"Physician & faculty · Hyderabad", route:"Generalist", mood:"Curious, low-tech", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: physician and part-time medical-college faculty, Hyderabad.",
    stated:'"Is this actually relevant to medicine — and what about accuracy and patient-data privacy?"', blocker:"Wants AI for clinical notes, research and teaching — not to become a techie; time-starved and cares about ethics.",
    brief:`You are Dr. Anjali, 45, a physician and part-time medical-college faculty member in Hyderabad. Mood: highly intelligent but a very low tech base; you care about accuracy, ethics and data privacy. You attended OutSkill's free AI mastermind. STATED objections: "is this relevant to medicine / teaching?", "what about accuracy and patient-data privacy?", "I'm not technical at all", "my schedule is irregular — duty hours." TRUE driver (reveal under good discovery): use AI inside your practice — clinical documentation, research, lesson materials, case prep — and stay current for patients and students. You warm up to profession-specific use cases, honest talk about AI's limits and ethics, recordings/flexible access, and examples of doctors/professors already in the cohort. Thoughtful, precise Indian-English.`},
  { id:"p8", name:"Suresh", gender:"male", tag:"Retired executive · Mysuru", route:"Generalist", mood:"Warm, unhurried", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: recently retired corporate executive, Mysuru.",
    stated:'"Am I too old for this — and what if I can\'t keep pace?"', blocker:"Wants an encore career (consulting/teaching/advisory) and to stay relevant; on a fixed income and will need setup help.",
    brief:`You are Suresh, 61, a recently retired corporate executive in Mysuru. Mood: warm, story-rich, unhurried — and once convinced, among the most committed learners. You attended OutSkill's free AI mastermind. STATED objections: "am I too old for this?", "what if I can't keep pace / I slow the batch down?", "I'm on a fixed income", "I'll need help just setting up the tools." TRUE driver (reveal under warmth + good discovery): an encore career — consulting, teaching or advising, maybe helping a family business — plus mental sharpness, independence and pride in not being left behind. You warm up to genuine respect and patience, stories of 55+ and career-break learners thriving, recordings + hand-holding support, and the 'your experience + AI is a consulting goldmine' angle. Gentle, reflective Indian-English.`},
  { id:"p9", name:"Salman", gender:"male", tag:"Undergraduate · tier-2 city", route:"Generalist", mood:"High-energy", ttsLang:"en-IN",
    lead:"Attended the free AI mastermind. Role: undergraduate student in a tier-2 Indian city.",
    stated:'"This sounds amazing but I genuinely can\'t afford it — I\'d have to ask my parents."', blocker:"Genuine budget constraint (parents are the real decision-makers); wants an employability edge and an AI portfolio.",
    brief:`You are Salman, 19, an undergraduate in a tier-2 Indian city. Mood: high energy, quick to say yes — then you hit the payment wall, because your parents are the real decision-makers. You attended OutSkill's free AI mastermind. STATED objections: "I can't afford it / I need to ask my parents", "will this actually get me a job?", "should I do this or another degree?" TRUE driver (fairly open): an employability edge, an AI portfolio, money-curiosity and a fear of graduating 'ordinary' — you want to be in the 1%. You warm up to portfolio-and-outcome framing, EMI / early-bird pricing, a parent-friendly justification you can take home, and proof that beginners with no background succeed. Eager, fast-talking Indian-English.`},
];

/* ------------------------------------------------------------------ */
function learnerSystem(p, learnedFacts) {
  const factsBlock = learnedFacts && learnedFacts.length > 0
    ? `\n=== WHAT YOU'VE LEARNED FROM PREVIOUS REPS (already in your head before this call) ===\nPrevious OutSkill reps have told you things — you've absorbed some of it. These are facts you genuinely already know, so you can ask sharper follow-up questions, challenge details that don't match, or demand better explanations when a rep is vague:\n${learnedFacts.map((f, i) => `${i+1}. ${f}`).join("\n")}\nUse this knowledge naturally. Don't recite it; let it inform your reactions. If a rep contradicts something above, push back ("wait, I thought the price was…"). If they're consistent, acknowledge it briefly ("right, someone mentioned that").\n`
    : "";
  return `You are running a live, VOICE sales-training role-play for OutSkill. You PLAY A PROSPECTIVE LEARNER on a phone call. The person talking to you is a NEW OUTSKILL SALES REP practicing. Behave like a realistic, semi-interested prospect.

=== WHAT YOU KNOW (you attended a free workshop — that's all) ===
You attended an OutSkill AI workshop recently. You have vague awareness that OutSkill runs a paid AI training program — something about a 14-day accelerator, live sessions, and maybe a certificate. That's roughly it. You do NOT know the exact price, EMI terms, program names, batch dates, specific tools covered, or anything beyond broad impressions from the event. If you're asked about those details, you don't know — that's the rep's job to explain.
${factsBlock}

=== WHO YOU ARE FOR THIS ENTIRE CALL ===
${p.brief}

=== HOW TO BEHAVE (this is spoken aloud, so sound like real speech) ===
- Stay 100% in character. NEVER reveal you are an AI. NEVER coach the rep or break character.
- Talk like a real person on a phone call: short sentences, contractions, the occasional "hmm", "yeah but", sometimes ask them to repeat. You are NOT a Q&A machine — volunteer some things, hold others back.
- Keep EACH reply very short — usually 1-2 spoken sentences. Never monologue. This is a back-and-forth conversation.
- DRIVE sometimes, don't just answer. Ask the rep real questions about what actually matters to you — "what's actually in it?", "how much does it cost?", "how much time per week?", "is it live or recorded?", "what if it doesn't work for me?", "do you have payment options?". Make them earn it.
- When the rep explains something (price, EMI, program content), GRAB THE POINT: remember it for the rest of the call and react naturally — surprised, reassured, skeptical, curious — based on your character. Don't pre-empt; let them tell you. If they already told you the price, don't ask again — refer back to what they said ("you said it's 95k, right?").
- Build on the conversation. Each turn, factor in everything the rep has already told you this call; get progressively more informed and either warmer or more guarded based on how well they're handling you.
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
- LISTEN and adapt: track everything the learner has told you (their role, budget, coding ability, concerns) and tailor each reply to THAT — never restart the pitch or repeat info they already have. Answer the question they actually asked, then move the call forward.
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

SCORE the rep on this weighted rubric (total 100 points):
1. Opening & rapport — warm, personalised, references the workshop (max 10)
2. Discovery & qualification — MUST establish coding ability for routing; also uncover goal, timeline, budget sensitivity (max 20)
3. Correct program routing & fit — right track for this person, explained clearly (max 15)
4. Value framing & differentiation — ties features to THIS person's goal; not a feature dump (max 15)
5. Objection handling — empathy first, one specific fact, confirms it landed, uncovers real blocker (max 20)
6. Pricing, EMI & trust — correct market (India INR / international USD), correct payment route (Razorpay/Pine Labs/Shopse/Fibe-Propel for India; XP for international), Indian EMI framed as zero-cost, 9% fee disclosed for international installments, EMI tenure 3/6/9/12 months, no fabricated price or discount (max 10)
7. Close & next step — trial close, concrete commitment or low-risk reason to decide (max 10)

CALIBRATION (use the full 0–100 range — scores must reflect real skill differences):
- 0–30: Barely engaged; no discovery, no structure, major compliance violations
- 31–50: Weak; attempted basics but missed most rubric items or made serious errors
- 51–65: Average; covered some rubric items adequately, a few gaps
- 66–79: Good; most rubric items covered well, minor gaps
- 80–89: Strong; covered all rubric items, only small polish needed
- 90–100: Excellent; every rubric item well-executed with natural, confident delivery

A rep who just pitches without discovery scores ≤ 45. A rep who discovers well but closes weakly scores 55–65. A rep who nails discovery, routing, objection handling, and close scores 75+.

HARD AUTO-FLAGS (list in the "flags" array; the rule applies ONLY when clearly violated):
- Explicit false guarantee (e.g. "100% job guarantee", "you WILL get a job", "guaranteed income") → cap overall at 40. (Normal career benefit statements like "this helps you get hired" are NOT flagged.)
- Wrong program recommended → force category 3 to 1.
- NSDC value claimed to an INTERNATIONAL learner → category 6 at most 2.
- Told an INDIAN learner that EMI costs extra / carries interest (Indian EMI is zero-cost) → flag + deduct from category 6.
- 9% convenience fee NOT mentioned when an INTERNATIONAL learner asked about installments → flag.
- Quoted an EMI tenure other than 3/6/9/12 months, or invented a price or discount → flag.
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
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    else return null;
    // Pass 1: direct parse
    try { return JSON.parse(t); } catch {}
    // Pass 2: fix common LLM quirks (trailing commas, unquoted keys, single-quoted values)
    try {
      const r = t
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^'\\]*)'/g, ': "$1"')
        .replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(r);
    } catch {}
    // Pass 3: aggressive — strip everything after last valid } and retry
    try {
      const cleaned = t.replace(/[\x00-\x1F\x7F]/g, " ")
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
      return JSON.parse(cleaned);
    } catch {}
    return null;
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
const ttsSnippet = text => cleanForTTS(text);
// Known male/female voice-name hints across Chrome / Edge / macOS / mobile.
const FEMALE_HINTS = /(female|woman|samantha|aria|libby|jenny|sonia|neerja|swara|kalpana|heera|veena|tessa|fiona|karen|moira|zira|hazel|google uk english female|google us english.*female)/i;
const MALE_HINTS   = /(\bmale\b|\bman\b|prabhat|ravi|hemant|guy|david|mark|rishi|alex|daniel|fred|oliver|george|google uk english male)/i;

function pickVoice(voices, lang, gender) {
  if (!voices.length) return null;
  const norm = s => (s || "").replace("_", "-").toLowerCase();
  const en = voices.filter(v => /^en/i.test(v.lang));
  if (!en.length) return voices[0];

  const matchGender = v => {
    if (gender === "female") return FEMALE_HINTS.test(v.name) && !MALE_HINTS.test(v.name);
    if (gender === "male")   return MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name);
    return true;
  };

  // Score each English voice; higher = more human / more on-target. This makes
  // the mock-call voice sound like a real Indian person, not a robot.
  const score = v => {
    const n = (v.name || "").toLowerCase();
    let s = 0;
    // 1) The single most natural class on each platform
    if (/natural/.test(n)) s += 60;                      // MS "… Online (Natural)" — most human
    if (/\bonline\b/.test(n)) s += 14;
    if (/google/.test(n)) s += 45;                        // Google neural voices — very natural
    if (/neural|premium|enhanced/.test(n)) s += 25;
    if (/siri|samantha/.test(n)) s += 18;                 // Apple high-quality
    // 2) Indian English locale strongly preferred (en-IN)
    if (/in$/i.test(v.lang)) s += 50;
    // Known Indian voice names (MS Neerja/Prabhat, Google hi-IN, etc.)
    if (/neerja|prabhat|heera|ravi|swara|hemant|kalpana|aarav|ananya|kavya|priya|rehaan/.test(n)) s += 30;
    // 3) Gender match
    if (matchGender(v)) s += 20;
    // 4) Penalise obviously robotic / legacy compact voices
    if (/compact|espeak|microsoft (david|zira|mark|hazel) desktop/.test(n)) s -= 25;
    return s;
  };

  const ranked = [...en].sort((a, b) => score(b) - score(a));
  return ranked[0] ||
    en.find(v => norm(v.lang) === norm(lang || "")) ||
    en[0] || voices[0] || null;
}

/* ================================================================== */
export default function App() {
  const [section, setSection] = useState("dashboard"); // login(gate) | dashboard | stage | dept | home | salesuccess | practice | realcall | reports | followups

  // ---- Onboarding journey: Stage 0 auth + 12-stage progress (persisted) ----
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("sarafai_user") || "null"); } catch { return null; } });
  const [completed, setCompleted] = useState(() => { try { return JSON.parse(localStorage.getItem("sarafai_journey_v1") || "[]"); } catch { return []; } });
  const [openStage, setOpenStage] = useState(2);
  const [entered, setEntered] = useState(false); // cover splash shows first, before login

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

  // Accumulated product knowledge extracted from past agent-mode calls.
  // Stored in localStorage so the AI prospect gets progressively smarter.
  const [learnedFacts, setLearnedFacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sarafai_learned_facts_v1") || "[]"); } catch { return []; }
  });
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
  const [rate, _setRate] = useState(1.08); // TTS speaking speed — natural conversational pace

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
  const rateRef = useRef(1.08);
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
  const sysPrompt = (mode === "learner" ? learnerSystem(activePersona, learnedFacts) : agentSystem()) + difficultyModifier;

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
        setTimeout(() => listenRef.current(), 200);
      }
    };
    const synth = window.speechSynthesis;
    if (!synth) { reArm(); return; }
    try { synth.cancel(); } catch {}

    const clean = ttsSnippet(text);

    // Split into ≤160-char word-boundary chunks
    const chunks = [];
    let rem = clean;
    while (rem.length > 0) {
      if (rem.length <= 160) { chunks.push(rem); break; }
      let cut = rem.lastIndexOf(" ", 160);
      if (cut <= 0) cut = 160;
      chunks.push(rem.slice(0, cut).trim());
      rem = rem.slice(cut).trim();
    }
    if (!chunks.length) { reArm(); return; }

    // Tiny per-utterance jitter so it doesn't sound mechanically uniform.
    const jitter = (Math.random() - 0.5) * 0.05;
    const spkRate = rateRef.current + jitter;
    // Pitch kept close to 1.0 (natural human range) — extreme pitch sounds synthetic.
    const spkPitch = (genderRef.current === "male" ? 0.97 : 1.05) + jitter;

    setSpeaking(true);

    // Queue ALL chunks upfront — Chrome's internal queue handles sequencing
    // reliably. Chaining via onend is unreliable because onend often doesn't
    // fire in Chrome, leaving subsequent chunks unspoken.
    chunks.forEach((chunk, idx) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = spkRate; u.pitch = spkPitch; u.volume = 1;
      if (idx === chunks.length - 1) {
        u.onend = () => { clearInterval(alive); setSpeaking(false); reArm(); };
        u.onerror = () => { clearInterval(alive); setSpeaking(false); reArm(); };
      }
      try { synth.speak(u); } catch {}
    });

    // Keepalive: nudge Chrome every 4s so queue doesn't freeze
    const alive = setInterval(() => {
      if (!synth.speaking) { clearInterval(alive); return; }
      try { synth.pause(); synth.resume(); } catch {}
    }, 4000);
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
      if (!parsed) {
        if (raw && raw.trim()) setCardRaw(raw);
        else setErr("The scorecard came back empty. Please try ending the call again.");
      }
      if (parsed) {
        setCard(parsed);
        completeStage(7); // Stage 7 (Mock-Call Room) clears once a call is scored
        const entry = {
          date: Date.now(),
          persona: activePersona.name,
          personaTag: activePersona.tag,
          mode,
          rep: repName || "",
          difficulty,
          duration: fmtTime(seconds),
          overall: parsed.overall,
          correctRouting: parsed.correctRouting,
          // store per-category percentages so we can chart improvement by skill
          categories: parsed.categories.map(c => ({ name: c.name, pct: Math.round((c.score / c.max) * 100) })),
        };
        const nh = [entry, ...history].slice(0, 50); setHistory(nh);
        try { localStorage.setItem("sarafai_history_v1", JSON.stringify(nh)); } catch {}
      }
      // Save the lightweight scorecard summary to the shared team store so it
      // shows up in everyone's dashboard (tagged by rep name). No transcript is
      // sent. Harmless no-op if no DB is configured.
      if (parsed) {
        try {
          await fetch("/api/save-call", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ts: Date.now(), mode,
              rep: repName || "Anonymous",
              persona: activePersona.name, personaTag: activePersona.tag,
              difficulty,
              duration: fmtTime(seconds),
              overall: parsed.overall,
              correctRouting: parsed.correctRouting,
              categories: parsed.categories.map(c => ({ name: c.name, pct: Math.round((c.score / c.max) * 100) })),
              card: parsed,
            }),
          });
        } catch {}
      }

      // When the USER was the rep (learner mode = AI is prospect), extract what
      // the rep correctly taught the prospect and save it so future AI prospects
      // ask sharper, more informed questions — the AI gets smarter every call.
      if (mode === "learner") {
        try {
          const extractRaw = await callClaude({
            system: `You are a knowledge extractor for a sales-training app. Given a call transcript where a sales rep pitched OutSkill's AI program to a prospect, extract ONLY the product facts, pricing details, EMI terms, program features, or rebuttals that the REP stated CORRECTLY and clearly. These will be injected into future AI prospects so they ask better follow-up questions.

Return ONLY a JSON array of short, factual strings (each under 20 words). No commentary, no markdown.
Example: ["The Generalist track costs Rs 95,000 in India", "EMI is available for up to 6 months", "The program is 14 days of live sessions"]
If the rep said nothing factually useful or correct, return [].`,
            messages: [{ role: "user", content: `TRANSCRIPT:\n${transcript}` }],
            json: true,
          });
          let newFacts = [];
          try {
            const t = extractRaw.trim();
            const s = t.indexOf("["), e = t.lastIndexOf("]");
            if (s >= 0 && e > s) newFacts = JSON.parse(t.slice(s, e + 1));
          } catch {}
          if (Array.isArray(newFacts) && newFacts.length > 0) {
            setLearnedFacts(prev => {
              // Deduplicate: skip facts already captured (case-insensitive fuzzy match)
              const existing = new Set(prev.map(f => f.toLowerCase().slice(0, 40)));
              const fresh = newFacts.filter(f => typeof f === "string" && f.trim() && !existing.has(f.toLowerCase().slice(0, 40)));
              const updated = [...prev, ...fresh].slice(-30); // keep last 30 facts
              try { localStorage.setItem("sarafai_learned_facts_v1", JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        } catch {}
      }
    } catch {
      setErr("Couldn't generate the scorecard. Try ending the call again.");
    } finally { setGrading(false); }
  };

  const reset = () => { stopAll(); setScreen("setup"); setMessages([]); apiMsgsRef.current = []; setCard(null); setCardRaw(""); setErr(""); setSeconds(0); setInterim(""); setCallStage(0); setHint(""); setMood("neutral"); };

  /* ---- Journey navigation & progress ---- */
  const completeStage = (n) => {
    setCompleted(prev => {
      if (prev.includes(n)) return prev;
      const nx = [...prev, n].sort((a, b) => a - b);
      try { localStorage.setItem("sarafai_journey_v1", JSON.stringify(nx)); } catch {}
      return nx;
    });
  };
  const onAuth = (u) => {
    setUser(u);
    try { localStorage.setItem("sarafai_user", JSON.stringify(u)); localStorage.setItem("sarafai_visitor_name", u.name || ""); } catch {}
    setSection("dashboard");
  };
  const onLogout = () => {
    setUser(null);
    try { localStorage.removeItem("sarafai_user"); } catch {}
    setSection("dashboard");
  };
  const goStage = (n) => {
    if (n === 1) { setSection("dashboard"); return; }
    if (!isUnlocked(n, completed)) return; // locked — needs the previous stage done
    setOpenStage(n); setSection("stage");
  };
  const goNextFrom = (n) => {
    const nx = n + 1;
    if (nx <= 12) { setOpenStage(nx); setSection("stage"); }
    else setSection("dashboard");
  };

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
        {!entered ? (
          <Cover serif={serif} onEnter={() => setEntered(true)} />
        ) : !user ? (
          <LoginScreen onAuth={onAuth} />
        ) : (<>
        {!["cover","dept","login","dashboard","stage"].includes(section) && (
          <Header serif={serif} section={section} goHome={() => { if (screen === "call") return; reset(); setSection("dashboard"); }} inCall={screen === "call"} />
        )}

        {section === "dashboard" && (
          <Dashboard user={user} completed={completed} goStage={goStage} onLogout={onLogout} />
        )}

        {section === "stage" && (() => {
          const def = STAGES.find(s => s.n === openStage) || STAGES[1];
          const wrap = (inner) => (
            <StagePage stage={def} isDone={completed.includes(def.n)}
              onComplete={() => { completeStage(def.n); goNextFrom(def.n); }}
              goDashboard={() => setSection("dashboard")}>{inner}</StagePage>
          );
          if (openStage === 7) return wrap(
            <LaunchCard Icon={Phone} title="Enter the Mock-Call Room"
              desc="Pick a persona, hint-mode and difficulty, then run a live voice mock-call against a realistic AI prospect. You'll get a scored coaching breakdown the moment you hang up."
              cta="Launch Mock-Call Room" onLaunch={() => { reset(); setSection("practice"); }} />
          );
          if (openStage === 8) return wrap(<PersonalProgress history={history} repName={repName} serif={serif} />);
          if (openStage === 9) return wrap(<><CertProgressStrip history={history} serif={serif} /><CertificatesSection history={history} repName={repName} serif={serif} /></>);
          if (openStage === 11) return wrap(
            <div>
              <LaunchCard Icon={Radio} title="Open Live Work Mode"
                desc="Record a real learner call, auto-transcribe it, and generate a CRM-ready report with the single best next action."
                cta="Record & report a call" onLaunch={() => setSection("realcall")} />
              <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
                <button onClick={() => setSection("reports")} style={{ ...secondaryBtn, padding:"10px 16px", fontSize:13 }}><TrendingUp size={15}/><span style={{ marginLeft:7 }}>View Reports</span></button>
                <button onClick={() => setSection("followups")} style={{ ...secondaryBtn, padding:"10px 16px", fontSize:13 }}><Clock size={15}/><span style={{ marginLeft:7 }}>Follow-ups</span></button>
              </div>
            </div>
          );
          if (openStage === 12) return wrap(<PersonalProgress history={history} repName={repName} serif={serif} />);
          if (openStage === 3) return wrap(<MastermindRecordings />);
          return wrap(null);
        })()}

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
              difficulty={difficulty} setDifficulty={setDifficulty}
              learnedFacts={learnedFacts} clearLearnedFacts={()=>{ setLearnedFacts([]); try { localStorage.removeItem("sarafai_learned_facts_v1"); } catch {} }}/>
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

        {section === "realcall" && <RealCall serif={serif} goHome={() => setSection("dashboard")} />}
        {section === "reports" && <Reports serif={serif} />}
        {section === "followups" && <FollowUps serif={serif} go={setSection} />}
        {section === "feedbackwall" && <FeedbackWall serif={serif} goBack={() => setSection("dashboard")} defaultName={repName} />}
        </>)}
      </div>

      {/* Background music removed site-wide. */}
    </div>
  );
}

/* ------------------------------------------------------------------ */
const SECTION_TITLE = { home:"Inside Sales", salesuccess:"Sales Success", practice:"Mock Calls", realcall:"Real Call · Record & Report", reports:"Reports & Pipeline", followups:"Follow-ups" };
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
// Used by wired stages (7 Mock-Call Room, 11 Live Work) to hand off into a
// full-screen built tool while keeping the stage's chrome around it.
function LaunchCard({ Icon, title, desc, cta, onLaunch }) {
  return (
    <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:"22px", display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
      <div style={{ width:50, height:50, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", color:LIME, flexShrink:0 }}>
        {Icon ? <Icon size={22}/> : null}
      </div>
      <div style={{ flex:1, minWidth:220 }}>
        <div style={{ fontFamily:"'Fraunces', Georgia, serif", fontSize:19, fontWeight:600, marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:14, color:MUTE, lineHeight:1.55, marginBottom:14 }}>{desc}</div>
        <button onClick={onLaunch} style={primaryBtn}>{cta}<ChevronRight size={16} style={{ marginLeft:6 }}/></button>
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

function Cover({ serif, onEnter }) {
  useEffect(() => {
    const t = setTimeout(onEnter, 12000);
    const onKey = (e) => { if (e.key === "Enter" || e.key === " ") onEnter(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div onClick={onEnter} role="button" title="Begin"
      style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", cursor:"pointer", position:"relative", padding:"40px 18px 90px" }}>
      <div className="osf">
        {/* brand dot-mark */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:22 }}>
          {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow: d?`0 0 14px ${LIME}55`:"none" }} />))}
        </div>
        <div style={{ fontSize:"clamp(10px,3vw,13px)", letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:18, fontWeight:600 }}>OutSkill · New-Joiner Onboarding</div>
        <h1 style={{ ...serif, fontSize:"clamp(34px, 9vw, 92px)", fontWeight:600, lineHeight:1.05, margin:"0 0 18px", letterSpacing:-1 }}>
          From day one to<br/><span style={{ color:LIME }}>deal-closer.</span>
        </h1>
        <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,18px)", maxWidth:600, margin:"0 auto", lineHeight:1.55 }}>
          A guided training journey for every new OutSkill joiner — company knowledge, product &amp; offer, live mock-calls with instant coaching, and the ramp to real work. Starting with the Sales department.
        </p>
        <div style={{ marginTop:30, fontSize:12.5, color:MUTE, display:"inline-flex", alignItems:"center", gap:9 }}>
          <span className="osd"/><span className="osd"/><span className="osd"/>
          <span style={{ marginLeft:4 }}>tap anywhere to begin</span>
        </div>

        {/* Built-by credit */}
        <div onClick={(e)=>e.stopPropagation()} style={{ marginTop:26, display:"flex", justifyContent:"center" }}>
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
    { id:"practice", icon:<GraduationCap size={22}/>, title:"Mock Calls", desc:"Train new reps against realistic AI prospects, then get an instant coaching scorecard.", tag: avg!==null ? `${history.length} practiced · avg ${avg}` : "Mock call + coaching" },
    { id:"realcall", icon:<Mic size={22}/>, title:"Real Call · Record & Report", desc:"Upload a recording of a real learner call. Get a transcript and a CRM-ready report with next steps.", tag:"Upload → transcribe → report", soon:true },
    { id:"reports", icon:<TrendingUp size={22}/>, title:"Reports & Pipeline", desc:"Every real call in one place — interest level, intent, and how many learners you contacted.", tag:"Sales head + management view", soon:true },
    { id:"followups", icon:<Clock size={22}/>, title:"Follow-ups", desc:"Who to call back and when, with what you already discussed and what's still open.", tag:"Never miss a callback", soon:true },
  ];
  return (
    <div className="osf">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <button onClick={goBack} style={{ ...secondaryBtn, padding:"7px 13px", fontSize:12.5 }}>
          <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back to start</span>
        </button>
      </div>
      <h1 style={{ ...serif, fontSize:"clamp(28px,7vw,40px)", fontWeight:600, margin:"0 0 8px", letterSpacing:-0.7 }}>{(()=>{ try { const n=localStorage.getItem("sarafai_visitor_name"); return n ? `Welcome back, ${n}. What's the move?` : "Welcome back. What's the move?"; } catch { return "Welcome back. What's the move?"; } })()}</h1>
      <p style={{ color:MUTE, margin:"0 0 28px", fontSize:"clamp(14px,4vw,16.5px)", maxWidth:600, lineHeight:1.5 }}>
        Train new joiners on mock calls, then run, record and report on real learner calls — all in one place.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:14 }}>
        {tiles.map(t=>(
          <button key={t.id} onClick={()=> t.soon ? null : go(t.id)} disabled={t.soon}
            style={{ position:"relative", textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:18, padding:"20px 20px 18px", transition:"all .16s ease", cursor: t.soon ? "not-allowed" : "pointer", opacity: t.soon ? 0.62 : 1 }}
            onMouseEnter={e=>{ if(t.soon) return; e.currentTarget.style.borderColor="rgba(194,238,69,0.5)";e.currentTarget.style.background="rgba(194,238,69,0.06)";}}
            onMouseLeave={e=>{ if(t.soon) return; e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
            {t.soon && (
              <span style={{ position:"absolute", top:14, right:14, display:"inline-flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", color:"#e8b24b", background:"rgba(232,178,75,0.12)", border:"1px solid rgba(232,178,75,0.4)", borderRadius:30, padding:"4px 10px" }}>
                <Clock size={11}/> In process
              </span>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:50, height:50, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", color:LIME, flexShrink:0 }}>{t.icon}</div>
              <span style={{ ...serif, fontSize:20.5, fontWeight:600, paddingRight: t.soon ? 86 : 0 }}>{t.title}</span>
              {!t.soon && <ChevronRight size={19} color={MUTE} style={{ marginLeft:"auto" }}/>}
            </div>
            <div style={{ fontSize:14.5, color:MUTE, lineHeight:1.5, marginBottom:12, minHeight:42 }}>{t.desc}</div>
            <div style={{ fontSize:11.5, letterSpacing:.4, textTransform:"uppercase", color: t.soon ? MUTE : LIME_DIM, fontWeight:600 }}>{t.soon ? "Coming soon — still being built" : t.tag}</div>
          </button>
        ))}
      </div>

      {/* Distinct feedback CTA — separated from the feature tiles */}
      <button onClick={()=>go("feedbackwall")}
        style={{ width:"100%", textAlign:"left", marginTop:24, background:"linear-gradient(100deg, rgba(194,238,69,0.14), rgba(194,238,69,0.04))", border:`1px solid rgba(194,238,69,0.4)`, borderRadius:18, padding:"20px 22px", display:"flex", alignItems:"center", gap:18, flexWrap:"wrap", transition:"all .16s ease" }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.75)";e.currentTarget.style.transform="translateY(-1px)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.4)";e.currentTarget.style.transform="none";}}>
        <div style={{ display:"flex", gap:2 }}>{[1,2,3,4,5].map(n=>(<Star key={n} size={20} color="#e8b24b" fill="#e8b24b"/>))}</div>
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ ...serif, fontSize:20, fontWeight:600, marginBottom:3 }}>Tried it? Tell us in 10 seconds. 👀</div>
          <div style={{ fontSize:13.5, color:MUTE, lineHeight:1.5 }}>Loved the mock call? Hated something? Drop a rating + a line — your honest take shapes what we build next. Everyone's reviews are public.</div>
        </div>
        <span style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:13, fontWeight:700, color:INK, background:LIME, borderRadius:30, padding:"10px 18px", flexShrink:0 }}>
          Leave a review <ChevronRight size={16}/>
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public feedback wall — testers leave a name, a 1-5 star rating and a
   comment. Everyone sees everyone's reviews. */
function Stars({ value, onChange, size = 22 }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div style={{ display:"inline-flex", gap:4 }}>
      {[1,2,3,4,5].map(n=>(
        <button key={n} type="button"
          onMouseEnter={onChange ? ()=>setHover(n) : undefined}
          onMouseLeave={onChange ? ()=>setHover(0) : undefined}
          onClick={onChange ? ()=>onChange(n) : undefined}
          style={{ background:"none", border:"none", padding:0, lineHeight:0, cursor: onChange ? "pointer" : "default" }}>
          <Star size={size} color={n<=active ? "#e8b24b" : MUTE} fill={n<=active ? "#e8b24b" : "none"} />
        </button>
      ))}
    </div>
  );
}

function FeedbackWall({ serif, goBack, defaultName }) {
  const [name, setName] = useState(defaultName || "");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState(null); // null=loading
  const [configured, setConfigured] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const load = () => {
    fetch("/api/feedback")
      .then(r=>r.json())
      .then(d=>{ setConfigured(!!d.configured); setReviews(Array.isArray(d.reviews)?d.reviews:[]); })
      .catch(()=>{ setConfigured(false); setReviews([]); });
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("Please add your name.");
    if (!rating) return setErr("Please tap the stars to give a rating.");
    if (!comment.trim()) return setErr("Please write a quick comment.");
    setPosting(true);
    try {
      const r = await fetch("/api/feedback", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ name: name.trim(), rating, comment: comment.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Couldn't post your feedback.");
      setReviews(prev => [d.review, ...(prev||[])]);
      setComment(""); setRating(0); setDone(true);
      setTimeout(()=>setDone(false), 2600);
    } catch (e) {
      setErr(e.message || "Couldn't post. Try again.");
    } finally { setPosting(false); }
  };

  const avg = reviews && reviews.length ? (reviews.reduce((a,r)=>a+(r.rating||0),0)/reviews.length) : 0;

  return (
    <div className="osf">
      <button onClick={goBack} style={{ ...secondaryBtn, marginBottom:16, padding:"7px 13px", fontSize:12.5 }}>
        <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back</span>
      </button>
      <h1 style={{ ...serif, fontSize:"clamp(28px,7vw,38px)", fontWeight:600, margin:"0 0 8px", letterSpacing:-0.6 }}>Be honest. We can take it. 😄</h1>
      <p style={{ color:MUTE, margin:"0 0 22px", fontSize:15, maxWidth:600, lineHeight:1.55 }}>
        You just trained against an AI prospect — wild, right? Tap the stars, drop a line on what hit and what flopped. Takes 10 seconds, and it genuinely decides what we build next. No filters — every review here is public.
      </p>

      {/* summary */}
      {reviews && reviews.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:14, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 18px", marginBottom:18, flexWrap:"wrap" }}>
          <div style={{ ...serif, fontSize:34, fontWeight:600, color:"#e8b24b" }}>{avg.toFixed(1)}</div>
          <div>
            <Stars value={Math.round(avg)} size={18}/>
            <div style={{ fontSize:12.5, color:MUTE, marginTop:3 }}>{reviews.length} review{reviews.length>1?"s":""}</div>
          </div>
        </div>
      )}

      {/* write a review */}
      <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:16, padding:"18px 18px 20px", marginBottom:24 }}>
        <div style={{ ...serif, fontSize:18, fontWeight:600, marginBottom:14 }}>Write a review</div>
        {!configured && (
          <div style={{ fontSize:12.5, color:"#e8b24b", background:"rgba(232,178,75,0.1)", border:"1px solid rgba(232,178,75,0.35)", borderRadius:10, padding:"10px 13px", marginBottom:14 }}>
            The feedback store isn’t connected yet — your review can’t be saved until the database is linked in Vercel.
          </div>
        )}
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
          style={{ width:"100%", background:INK, border:`1px solid ${BORDER}`, borderRadius:11, padding:"12px 14px", color:TXT, fontSize:14.5, marginBottom:12 }}/>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <span style={{ fontSize:13.5, color:MUTE }}>Your rating:</span>
          <Stars value={rating} onChange={setRating}/>
        </div>
        <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4}
          placeholder="Did the AI prospect feel real? What made you smile? What annoyed you? One line is plenty…"
          style={{ width:"100%", background:INK, border:`1px solid ${BORDER}`, borderRadius:11, padding:"12px 14px", color:TXT, fontSize:14.5, resize:"vertical", fontFamily:"inherit", marginBottom:err?8:14 }}/>
        {err && <div style={{ fontSize:12.5, color:"#e87a6b", marginBottom:12 }}>{err}</div>}
        {done && <div style={{ fontSize:12.5, color:LIME_DIM, marginBottom:12 }}>✓ Thanks! Your review is live below.</div>}
        <button onClick={submit} disabled={posting || !configured} style={{ ...primaryBtn, opacity: posting||!configured ? 0.6 : 1 }}>
          {posting ? <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/> : <Send size={16}/>}
          <span style={{marginLeft:8}}>{posting ? "Posting…" : "Post review"}</span>
        </button>
      </div>

      {/* the wall */}
      <SectionLabel>What people are saying</SectionLabel>
      {reviews === null ? (
        <div style={{ color:MUTE, fontSize:13.5, padding:"10px 2px" }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div style={{ color:MUTE, fontSize:13.5, padding:"10px 2px" }}>No reviews yet — be the first to share your thoughts.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {reviews.map((r,i)=>(
            <div key={r.id||i} style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7, flexWrap:"wrap" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(194,238,69,0.14)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontWeight:700, color:LIME, fontSize:13 }}>
                  {(r.name||"?").trim().charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight:600, color:TXT, fontSize:14 }}>{r.name||"Anonymous"}</span>
                <Stars value={r.rating} size={14}/>
                <span style={{ marginLeft:"auto", color:MUTE, fontSize:11.5 }}>{r.ts ? new Date(r.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : ""}</span>
              </div>
              <div style={{ fontSize:14, color:TXT, lineHeight:1.55, whiteSpace:"pre-wrap" }}>{r.comment}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function DeptSelect({ serif, goBack, onInsideSales, onSaleSuccess }) {
  const [nameInput, setNameInput] = useState("");
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem("sarafai_visitor_name") ? "dept" : "name"; } catch { return "name"; }
  });
  const [shake, setShake] = useState(false);
  const visitorName = (() => { try { return localStorage.getItem("sarafai_visitor_name") || ""; } catch { return ""; } })();

  const submit = () => {
    const n = nameInput.trim();
    if (!n) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    try { localStorage.setItem("sarafai_visitor_name", n); } catch {}
    // Log visitor name to server so admin can see who opened the site
    fetch("/api/log-visitor", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name: n }) }).catch(()=>{});
    setStep("dept");
  };

  if (step === "name") return (
    <div className="osf" style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 18px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:24 }}>
        {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background:d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow:d?`0 0 14px ${LIME}55`:"none" }}/>))}
      </div>
      <div style={{ fontSize:"clamp(10px,3vw,12px)", letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:20, fontWeight:600 }}>OutSkill · Sales Department</div>
      <h1 style={{ ...serif, fontSize:"clamp(30px,7vw,62px)", fontWeight:600, lineHeight:1.08, margin:"0 0 14px", letterSpacing:-1 }}>
        Hey, before we dive in —<br/><span style={{ color:LIME }}>what's your name?</span>
      </h1>
      <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,16px)", maxWidth:420, margin:"0 auto 36px", lineHeight:1.6 }}>
        Just your first name. We'll personalise your scorecards and track your progress on the team board.
      </p>
      <div style={{ width:"100%", maxWidth:360, animation: shake ? "shake .4s ease" : "none" }}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <input
          autoFocus
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="e.g. Rahul, Priya, Garvit…"
          style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:`1.5px solid ${nameInput.trim() ? "rgba(194,238,69,0.6)" : BORDER}`, borderRadius:14, padding:"16px 20px", fontSize:18, color:TXT, fontFamily:"inherit", outline:"none", textAlign:"center", transition:"border-color .2s" }}
        />
        <button onClick={submit} style={{ ...primaryBtn, width:"100%", marginTop:14, justifyContent:"center", fontSize:16, padding:"14px 22px" }}>
          <Sparkles size={17}/><span style={{ marginLeft:9 }}>Let's go</span>
        </button>
      </div>
      <button onClick={goBack} style={{ ...secondaryBtn, marginTop:28, padding:"8px 16px", fontSize:12.5 }}>
        <ArrowLeft size={14}/><span style={{ marginLeft:6 }}>Back</span>
      </button>
    </div>
  );

  return (
    <div className="osf" style={{ minHeight:"86vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 18px", position:"relative" }}>
      {/* brand dot-mark */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,11px)", gap:5, justifyContent:"center", marginBottom:20 }}>
        {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:11, height:11, borderRadius:"50%", background: d?LIME:"transparent", border:d?"none":`1.5px solid ${MUTE}`, boxShadow: d?`0 0 14px ${LIME}55`:"none" }} />))}
      </div>
      <div style={{ fontSize:"clamp(10px,3vw,12px)", letterSpacing:5, textTransform:"uppercase", color:LIME_DIM, marginBottom:14, fontWeight:600 }}>OutSkill · Sales Department</div>
      <h1 style={{ ...serif, fontSize:"clamp(28px,6vw,58px)", fontWeight:600, lineHeight:1.1, margin:"0 0 12px", letterSpacing:-1 }}>
        {visitorName ? <>Good to have you, <span style={{ color:LIME }}>{visitorName}.</span></> : "Which team are you on?"}
      </h1>
      <p style={{ color:MUTE, fontSize:"clamp(14px,4vw,16px)", maxWidth:480, margin:"0 auto 40px", lineHeight:1.55 }}>
        Pick your sales track and let's get to work.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, width:"100%", maxWidth:560 }}>
        <button onClick={onInsideSales}
          style={{ textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 22px", transition:"all .16s ease", cursor:"pointer" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.6)";e.currentTarget.style.background="rgba(194,238,69,0.07)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
          <div style={{ width:48, height:48, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <Phone size={22} color={LIME}/>
          </div>
          <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:8 }}>Inside Sales</div>
          <div style={{ fontSize:13.5, color:MUTE, lineHeight:1.5 }}>Mock call training, real call reporting, pipeline and follow-ups.</div>
          <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:LIME, fontWeight:600 }}>
            Enter <ChevronRight size={14}/>
          </div>
        </button>

        <button onClick={onSaleSuccess}
          style={{ textAlign:"left", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 22px", transition:"all .16s ease", cursor:"pointer" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(194,238,69,0.6)";e.currentTarget.style.background="rgba(194,238,69,0.07)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=PANEL;}}>
          <div style={{ width:48, height:48, borderRadius:14, background:"rgba(194,238,69,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <TrendingUp size={22} color={LIME}/>
          </div>
          <div style={{ ...serif, fontSize:22, fontWeight:600, marginBottom:8 }}>Sales Success</div>
          <div style={{ fontSize:13.5, color:MUTE, lineHeight:1.5 }}>Coming soon — details being added.</div>
          <div style={{ marginTop:16, display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:LIME, fontWeight:600 }}>
            Enter <ChevronRight size={14}/>
          </div>
        </button>
      </div>

      <button onClick={goBack} style={{ ...secondaryBtn, marginTop:32, padding:"8px 16px", fontSize:12.5 }}>
        <ArrowLeft size={14}/><span style={{marginLeft:6}}>Back</span>
      </button>
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
function Setup({ serif, mode, setMode, persona, setPersona, useCustom, setUseCustom, custom, setCustom, startCall, history, voiceWanted, setVoiceWanted, sttSupported, ttsSupported, repName, setRepName, difficulty, setDifficulty, learnedFacts, clearLearnedFacts }) {
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
      <h1 style={{ ...serif, fontSize:37, fontWeight:600, margin:"0 0 6px", letterSpacing:-0.5 }}>Run a mock call.</h1>
      <p style={{ color:MUTE, margin:"0 0 24px", fontSize:15, maxWidth:560 }}>
        Talk to a realistic prospect out loud, then get an instant, evidence-based scorecard. Run as many mock calls as you want — no senior rep required.
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

      {/* Certificate progress strip — motivates reps to keep going */}
      <CertProgressStrip history={history} serif={serif}/>

      {/* AI learning indicator — shows how many facts the prospect already knows */}
      {learnedFacts && learnedFacts.length > 0 && (
        <div style={{ background:"rgba(194,238,69,0.06)", border:`1px solid rgba(194,238,69,0.25)`, borderRadius:12, padding:"12px 16px", marginTop:18, display:"flex", alignItems:"center", gap:12 }}>
          <Sparkles size={16} color={LIME}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:TXT }}>AI prospect is getting smarter</div>
            <div style={{ fontSize:12, color:MUTE, marginTop:2 }}>Has absorbed <b style={{color:LIME}}>{learnedFacts.length}</b> fact{learnedFacts.length>1?"s":""} from past mock calls — will ask sharper follow-up questions this time.</div>
          </div>
          <button onClick={clearLearnedFacts} style={{ border:`1px solid ${BORDER}`, background:"transparent", color:MUTE, borderRadius:8, padding:"5px 10px", fontSize:11.5 }}>Reset</button>
        </div>
      )}

      <div style={{ marginTop:20, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <button onClick={startCall} style={primaryBtn}>
          {voiceWanted ? <Mic size={17}/> : <Phone size={17}/>} <span style={{marginLeft:8}}>{voiceWanted ? "Start voice call" : "Start the call"}</span>
        </button>
        {avg !== null && (
          <div style={{ fontSize:13, color:MUTE, display:"flex", alignItems:"center", gap:7 }}>
            <TrendingUp size={15} color={LIME_DIM}/> {history.length} past rep{history.length>1?"s":""} · avg score <b style={{color:TXT}}>{avg}</b>
          </div>
        )}
      </div>

      <div style={{ marginTop:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <SectionLabel>Your progress & certificates</SectionLabel>
          {streak >= 2 && <span style={{ fontSize:13, color:"#e8b24b", fontWeight:600, marginLeft:8 }}>🔥 {streak} day streak</span>}
        </div>
        <ProgressPanel history={history} serif={serif} repName={repName}/>
      </div>
    </div>
  );
}

/* Wrapper: lets each person see THEIR OWN progress, or toggle to the whole
   team's. Personal data comes from this browser's localStorage (instant,
   always available); the team view is pulled from the shared store. */
function ProgressPanel({ history, serif, repName }) {
  const [scope, setScope] = useState("mine"); // "mine" | "team"
  const [team, setTeam] = useState(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let live = true;
    fetch("/api/practice-calls")
      .then(r => r.json())
      .then(d => { if (!live) return; setConfigured(!!d.configured); setTeam(Array.isArray(d.calls) ? d.calls : []); })
      .catch(() => { if (live) { setConfigured(false); setTeam([]); } });
    return () => { live = false; };
  }, []);

  const Toggle = () => (
    <div style={{ display:"inline-flex", background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:3, marginBottom:4 }}>
      {[["mine","My mock calls"],["team","Everyone"]].map(([k,label])=>(
        <button key={k} onClick={()=>setScope(k)} style={{
          border:"none", borderRadius:8, padding:"6px 14px", fontSize:12.5, fontWeight:600,
          background: scope===k ? LIME : "transparent", color: scope===k ? INK : MUTE, transition:"all .15s",
        }}>{label}</button>
      ))}
    </div>
  );

  if (scope === "team") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {configured && <Toggle/>}
        {!configured ? (
          <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"16px 18px", fontSize:13, color:MUTE, lineHeight:1.6 }}>
            The shared team dashboard isn’t connected yet. Once a database is linked in Vercel, everyone’s mock calls show up here.
          </div>
        ) : team === null ? (
          <div style={{ color:MUTE, fontSize:13, padding:"10px 2px" }}>Loading the team’s practice…</div>
        ) : team.length === 0 ? (
          <div style={{ color:MUTE, fontSize:13, padding:"10px 2px" }}>No team mock calls logged yet. Be the first!</div>
        ) : (
          <TeamView calls={team} serif={serif} me={repName}/>
        )}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {configured && <Toggle/>}
      <PersonalProgress history={history} serif={serif} repName={repName}/>
    </div>
  );
}

/* Team leaderboard + everyone's recent calls, grouped by rep name.
   Click any row to open that call's full report. */
function TeamView({ calls, serif, me }) {
  const [detail, setDetail] = useState(null); // a call object, or null

  const byRep = {};
  calls.forEach(c => {
    const k = c.rep || "Anonymous";
    if (!byRep[k]) byRep[k] = { rep:k, scores:[], routed:0, best:null, worst:null };
    if (typeof c.overall === "number") {
      byRep[k].scores.push(c.overall);
      if (!byRep[k].best || c.overall > byRep[k].best.overall) byRep[k].best = c;
      if (!byRep[k].worst || c.overall < byRep[k].worst.overall) byRep[k].worst = c;
    }
  });
  const board = Object.values(byRep).map(r => ({
    rep: r.rep,
    n: r.scores.length,
    avg: r.scores.length ? Math.round(r.scores.reduce((a,b)=>a+b,0)/r.scores.length) : 0,
    best: r.scores.length ? Math.max(...r.scores) : 0,
    low: r.scores.length ? Math.min(...r.scores) : 0,
    bestCall: r.best,
  })).filter(r => r.n > 0).sort((a,b) => b.avg - a.avg);

  const meNorm = (me || "").trim().toLowerCase();
  const rowHover = { transition:"all .14s" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div>
        <SectionLabel>Team leaderboard · tap a name for their best call</SectionLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {board.map((r,i)=>{
            const isMe = r.rep.trim().toLowerCase() === meNorm && meNorm;
            return (
              <button key={i} onClick={()=> r.bestCall && setDetail(r.bestCall)} style={{ ...rowHover, textAlign:"left", display:"flex", alignItems:"center", gap:12, fontSize:13, background: isMe ? "rgba(194,238,69,0.10)" : PANEL, border:`1px solid ${isMe ? "rgba(194,238,69,0.45)" : BORDER}`, borderRadius:10, padding:"10px 13px", cursor:"pointer" }}>
                <span style={{ width:22, color:MUTE, fontWeight:700, fontSize:12 }}>{i+1}</span>
                <span style={{ color:TXT, fontWeight:600 }}>{r.rep}{isMe ? " (you)" : ""}</span>
                <span style={{ color:MUTE, fontSize:11.5 }}>{r.n} call{r.n>1?"s":""}</span>
                <span style={{ marginLeft:"auto", color:MUTE, fontSize:11.5 }}>
                  {r.n > 1 ? <><b style={{color:scoreColor(r.low)}}>{r.low}</b><span style={{opacity:.5}}>–</span><b style={{color:scoreColor(r.best)}}>{r.best}</b></> : <><span>best </span><b style={{color:scoreColor(r.best)}}>{r.best}</b></>}
                </span>
                <span style={{ fontWeight:700, color:scoreColor(r.avg), width:34, textAlign:"right" }}>{r.avg}</span>
                <ChevronRight size={15} color={MUTE}/>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <SectionLabel>Everyone’s recent calls · tap to see the report</SectionLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {calls.slice(0,15).map((c,i)=>(
            <button key={i} onClick={()=>setDetail(c)} style={{ ...rowHover, textAlign:"left", display:"flex", alignItems:"center", gap:12, fontSize:13, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:"9px 13px", cursor:"pointer" }}>
              <span style={{ fontWeight:700, color: scoreColor(c.overall), width:30 }}>{c.overall}</span>
              <span style={{ color:TXT, fontWeight:600 }}>{c.rep || "Anonymous"}</span>
              <span style={{ color:MUTE, fontSize:11.5 }}>vs {c.persona}</span>
              {c.correctRouting ? <CheckCircle2 size={14} color={LIME_DIM}/> : <XCircle size={14} color="#e87a6b"/>}
              <span style={{ marginLeft:"auto", color:MUTE, fontSize:11.5 }}>{new Date(c.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
              <ChevronRight size={15} color={MUTE}/>
            </button>
          ))}
        </div>
      </div>

      {/* Detail report modal — rendered via portal to escape parent stacking contexts */}
      {detail && createPortal(
        <div onClick={()=>setDetail(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"30px 14px", zIndex:9999, overflowY:"auto" }}>
          <div onClick={e=>e.stopPropagation()} className="osf oscroll" style={{ background:"#11140d", border:`1px solid ${BORDER}`, borderRadius:20, padding:"22px 22px 26px", width:"100%", maxWidth:760, marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div>
                <div style={{ ...serif, fontSize:21, fontWeight:600 }}>{detail.rep || "Anonymous"}’s call</div>
                <div style={{ fontSize:12.5, color:MUTE, marginTop:2 }}>
                  vs {detail.persona}{detail.difficulty?` · ${detail.difficulty}`:""}{detail.ts?` · ${new Date(detail.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`:""}
                </div>
              </div>
              <button onClick={()=>setDetail(null)} style={{ ...secondaryBtn, marginLeft:"auto", padding:"7px 13px", fontSize:12.5 }}>Close</button>
            </div>
            {detail.card
              ? <ScorecardReport card={detail.card} serif={serif} sub={`vs ${detail.persona}`} duration={detail.duration}/>
              : (
                // Older calls saved before full reports — show what we have
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
                    <Ring value={detail.overall}/>
                    <div style={{ fontSize:13.5, color:MUTE }}>{scoreVerdict(detail.overall)}</div>
                  </div>
                  {Array.isArray(detail.categories) && detail.categories.length > 0 && (
                    <Panel title="Category breakdown">
                      {detail.categories.map((c,i)=>(
                        <div key={i} style={{ marginBottom:11 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}><span>{c.name}</span><b style={{color:barColor(c.pct/100)}}>{c.pct}%</b></div>
                          <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}><div style={{ height:"100%", width:`${c.pct}%`, background:barColor(c.pct/100), borderRadius:6 }}/></div>
                        </div>
                      ))}
                    </Panel>
                  )}
                  <div style={{ fontSize:12.5, color:MUTE, marginTop:14 }}>This call was saved before detailed reports were added, so only the score summary is available.</div>
                </div>
              )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

/* One person's own improvement trend (from this browser's localStorage). */
function PersonalProgress({ history, repName, serif }) {
  if (!history.length) {
    return (
      <div>
        <CertificatesSection history={history} repName={repName} serif={serif}/>
        <div style={{ background:PANEL, border:`1px dashed ${BORDER}`, borderRadius:14, padding:"22px 20px", textAlign:"center", color:MUTE, fontSize:14 }}>
          No mock calls yet — run your first call above and your progress will appear here.
        </div>
      </div>
    );
  }
  // chronological (oldest → newest) for trend math
  const chron = [...history].reverse();
  const scores = chron.map(h => h.overall);
  const first = scores[0], latest = scores[scores.length - 1];
  const best = Math.max(...scores);
  const delta = latest - first;
  const last5 = scores.slice(-5);
  const prev5 = scores.slice(-10, -5);
  const recentAvg = last5.length ? Math.round(last5.reduce((a,b)=>a+b,0)/last5.length) : 0;
  const olderAvg = prev5.length ? Math.round(prev5.reduce((a,b)=>a+b,0)/prev5.length) : null;
  const trend = olderAvg !== null ? recentAvg - olderAvg : delta;

  // per-skill averages from stored category percentages
  const skillTotals = {};
  chron.forEach(h => (h.categories || []).forEach(c => {
    if (!skillTotals[c.name]) skillTotals[c.name] = { sum:0, n:0 };
    skillTotals[c.name].sum += c.pct; skillTotals[c.name].n += 1;
  }));
  const skills = Object.entries(skillTotals).map(([name,v]) => ({ name, pct: Math.round(v.sum/v.n) }));
  const weakest = skills.length ? skills.reduce((a,b)=>a.pct<b.pct?a:b) : null;
  const strongest = skills.length ? skills.reduce((a,b)=>a.pct>b.pct?a:b) : null;

  // sparkline geometry
  const W = 260, H = 56, n = scores.length;
  const pts = scores.map((s,i) => {
    const x = n === 1 ? W/2 : (i/(n-1))*W;
    const y = H - (s/100)*H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const Stat = ({ label, value, color }) => (
    <div style={{ flex:1, minWidth:88, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"11px 13px" }}>
      <div style={{ fontSize:10.5, letterSpacing:1, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>{label}</div>
      <div style={{ ...serif, fontSize:23, fontWeight:600, color: color || TXT }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <CertificatesSection history={history} repName={repName} serif={serif}/>
      {/* headline stats */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <Stat label="Calls done" value={history.length}/>
        <Stat label="Latest" value={latest} color={scoreColor(latest)}/>
        <Stat label="Best" value={best} color={scoreColor(best)}/>
        <Stat label="Trend" value={`${trend >= 0 ? "+" : ""}${trend}`} color={trend >= 0 ? LIME_DIM : "#e87a6b"}/>
      </div>

      {/* trend line */}
      {n >= 2 && (
        <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:12.5, color:MUTE }}>Score over time</span>
            <span style={{ fontSize:12.5, color: delta >= 0 ? LIME_DIM : "#e87a6b", fontWeight:600 }}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} since first call
            </span>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:"block", height:56 }}>
            <polyline points={pts} fill="none" stroke={LIME} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {scores.map((s,i)=>{ const x = n===1?W/2:(i/(n-1))*W, y = H-(s/100)*H; return <circle key={i} cx={x} cy={y} r="2.6" fill={scoreColor(s)}/>; })}
          </svg>
        </div>
      )}

      {/* focus area + strength */}
      {weakest && (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:200, background:"rgba(232,178,75,0.07)", border:"1px solid rgba(232,178,75,0.35)", borderRadius:12, padding:"11px 14px" }}>
            <div style={{ fontSize:10.5, letterSpacing:1, textTransform:"uppercase", color:"#e8b24b", marginBottom:3 }}>🎯 Work on this</div>
            <div style={{ fontSize:13.5, color:TXT, fontWeight:500 }}>{weakest.name}</div>
            <div style={{ fontSize:11.5, color:MUTE, marginTop:2 }}>averaging {weakest.pct}% across your calls</div>
          </div>
          {strongest && strongest.name !== weakest.name && (
            <div style={{ flex:1, minWidth:200, background:"rgba(159,194,58,0.07)", border:"1px solid rgba(159,194,58,0.35)", borderRadius:12, padding:"11px 14px" }}>
              <div style={{ fontSize:10.5, letterSpacing:1, textTransform:"uppercase", color:LIME_DIM, marginBottom:3 }}>💪 Your strength</div>
              <div style={{ fontSize:13.5, color:TXT, fontWeight:500 }}>{strongest.name}</div>
              <div style={{ fontSize:11.5, color:MUTE, marginTop:2 }}>averaging {strongest.pct}% across your calls</div>
            </div>
          )}
        </div>
      )}

      {/* recent calls list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {history.slice(0,5).map((h,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, fontSize:13, background:PANEL, border:`1px solid ${BORDER}`, borderRadius:10, padding:"9px 13px" }}>
            <span style={{ fontWeight:700, color: scoreColor(h.overall), width:30 }}>{h.overall}</span>
            <span style={{ color:TXT }}>{h.persona}</span>
            <span style={{ color:MUTE, fontSize:11.5 }}>{h.mode==="learner"?"practice":"demo"}</span>
            {h.difficulty && <span style={{ color:MUTE, fontSize:10.5, textTransform:"uppercase", letterSpacing:.5 }}>{h.difficulty}</span>}
            {h.correctRouting ? <CheckCircle2 size={14} color={LIME_DIM}/> : <XCircle size={14} color="#e87a6b"/>}
            <span style={{ marginLeft:"auto", color:MUTE, fontSize:11.5 }}>{new Date(h.date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
          </div>
        ))}
      </div>
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
            width:96, height:96, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
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
            <option value={1.08}>1.08× natural</option>
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
    // Last-ditch attempt: parse the raw string right here before giving up
    const rescued = normalizeScorecard(parseScorecard(cardRaw));
    if (rescued) {
      // Re-render with the rescued card by injecting it directly
      const fakeCard = rescued;
      const routedRight = fakeCard.correctRouting, isDemo = mode === "agent";
      const score = fakeCard.overall;
      const scoreColor = score >= 80 ? LIME : score >= 60 ? "#e8d24b" : "#e87a6b";
      return (
        <div className="osf">
          <div style={{ background:`linear-gradient(135deg,rgba(194,238,69,0.07) 0%,rgba(10,12,8,0) 60%)`, border:`1px solid ${BORDER}`, borderRadius:20, padding:"24px 24px 20px", marginBottom:18, display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
            <Ring value={score}/>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>{repName ? `${repName}'s coaching` : "Your call scorecard"}</div>
              <h2 style={{ ...serif, fontSize:30, fontWeight:600, margin:"0 0 12px", color:scoreColor }}>{scoreVerdict(score)}</h2>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Pill ok={routedRight}>{routedRight ? <CheckCircle2 size={13}/> : <XCircle size={13}/>}<span style={{marginLeft:5}}>Routed → {fakeCard.recommendedProgram}{routedRight?" ✓":" ✗"}</span></Pill>
                <Pill neutral><Clock size={12}/><span style={{marginLeft:5}}>{duration}</span></Pill>
              </div>
            </div>
            <div style={{ width:"100%", height:5, borderRadius:4, background:"rgba(255,255,255,0.07)", overflow:"hidden", marginTop:4 }}>
              <div style={{ height:"100%", width:`${score}%`, background:scoreColor, borderRadius:4, transition:"width .8s ease" }}/>
            </div>
          </div>
          <Panel title="Category breakdown">
            {fakeCard.categories.map((c,i)=>{ const pct=c.score/c.max; return (
              <div key={i} style={{ marginBottom:13 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}><span style={{ fontWeight:500 }}>{c.name}</span><span style={{ color:MUTE }}><b style={{ color:barColor(pct), fontSize:15 }}>{c.score}</b><span style={{fontSize:11}}>/{c.max}</span></span></div>
                <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}><div style={{ height:"100%", width:`${pct*100}%`, background:barColor(pct), borderRadius:6, transition:"width .7s ease" }}/></div>
              </div>
            );})}
          </Panel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:14, marginTop:14 }}>
            <ListPanel title="✓ What you did well" items={fakeCard.strengths} icon={<CheckCircle2 size={15} color={LIME_DIM}/>} color={LIME_DIM}/>
            <ListPanel title="✗ Where you lost points" items={fakeCard.lostPoints} icon={<Target size={15} color="#e8b24b"/>} color="#e8b24b"/>
            <ListPanel title="◎ Missed opportunities" items={fakeCard.missed} icon={<Sparkles size={15} color="#7bb8e8"/>} color="#7bb8e8"/>
            <ListPanel title="💬 Say this next time" items={fakeCard.sayNextTime} icon={<ChevronRight size={15} color={LIME}/>} color={LIME} quote/>
          </div>
          <FeedbackFooter reset={reset} again={again}/>
        </div>
      );
    }
    // Truly unparseable — show a clean human-readable summary (no raw JSON)
    const lines = cardRaw
      .replace(/```[\s\S]*?```/gi, "").replace(/[{}\[\]]/g, "")
      .split("\n").map(l => l.replace(/"/g,"").replace(/,\s*$/,"").trim()).filter(l => l && !l.match(/^\s*$/));
    return (<div className="osf">
      <h2 style={{...serif, fontSize:26, marginBottom:16}}>Your coaching feedback</h2>
      <div style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:14, padding:20, fontSize:14, color:TXT, lineHeight:2, whiteSpace:"pre-wrap" }}>{lines.join("\n")}</div>
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

/* ------------------------------------------------------------------ */
/* Certificate tier definitions                                         */
const CERT_TIERS = [
  { id:"beginner", level:1, calls:5, minAvg:50,
    title:"Sales Foundations", badge:"Beginner",
    color:"#cd7f32", glow:"rgba(205,127,50,0.35)",
    icon:"🥉",
    desc:"You've nailed the basics — opening, discovery, and rapport. A solid start to your sales journey.",
    tagline:"Foundations of sales, locked in." },
  { id:"intermediate", level:2, calls:10, minAvg:60,
    title:"Sales Practitioner", badge:"Intermediate",
    color:"#b0b8c1", glow:"rgba(176,184,193,0.35)",
    icon:"🥈",
    desc:"Discovery, objection handling, program routing — you handle the full call with confidence.",
    tagline:"You know the playbook. Now run it." },
  { id:"certified", level:3, calls:15, minAvg:70,
    title:"Certified Sales Agent", badge:"Sales Ready",
    color:LIME, glow:"rgba(194,238,69,0.35)",
    icon:"🏆",
    desc:"Top-tier performance across 15+ calls. You are ready to take real calls and close real deals for OutSkill.",
    tagline:"Ready for the real world. Go close." },
];

function certEarned(tier, history) {
  if (!history || history.length < tier.calls) return false;
  const avg = Math.round(history.reduce((a,h)=>a+h.overall,0)/history.length);
  return avg >= tier.minAvg;
}

/* Mini progress strip shown on the Setup page before starting a call */
function CertProgressStrip({ history, serif }) {
  const n = history.length;
  const avg = n ? Math.round(history.reduce((a,h)=>a+h.overall,0)/n) : 0;
  const next = CERT_TIERS.find(t => !certEarned(t, history));
  const earned = CERT_TIERS.filter(t => certEarned(t, history));

  return (
    <div style={{ background:"rgba(194,238,69,0.04)", border:`1px solid rgba(194,238,69,0.18)`, borderRadius:14, padding:"14px 16px", marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, letterSpacing:1.5, textTransform:"uppercase", color:LIME_DIM, fontWeight:700 }}>Your certificates</span>
        {earned.map(t => (
          <span key={t.id} style={{ fontSize:13 }} title={t.title}>{t.icon}</span>
        ))}
      </div>
      {next ? (
        <>
          <div style={{ fontSize:13, color:TXT, fontWeight:600, marginBottom:3 }}>
            Next: <span style={{ color:next.color }}>{next.icon} {next.title}</span>
          </div>
          <div style={{ fontSize:12, color:MUTE, marginBottom:10 }}>
            Need <b style={{color:TXT}}>{next.calls} calls</b> (avg ≥ <b style={{color:TXT}}>{next.minAvg}</b>) — you have <b style={{color:LIME}}>{n}</b> calls, avg <b style={{color:LIME}}>{avg || "—"}</b>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {/* calls progress */}
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:MUTE, marginBottom:3 }}><span>Calls</span><span>{Math.min(n,next.calls)}/{next.calls}</span></div>
              <div style={{ height:5, borderRadius:4, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,(n/next.calls)*100)}%`, background:next.color, borderRadius:4, transition:"width .8s ease" }}/>
              </div>
            </div>
            {/* avg score progress */}
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:MUTE, marginBottom:3 }}><span>Avg score</span><span>{avg||0}/{next.minAvg}</span></div>
              <div style={{ height:5, borderRadius:4, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,((avg||0)/next.minAvg)*100)}%`, background:next.color, borderRadius:4, transition:"width .8s ease" }}/>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ fontSize:13, color:LIME, fontWeight:600 }}>🏆 All certificates earned! You're a Certified Sales Agent.</div>
      )}
    </div>
  );
}

/* Full certificate modal — opens when "View Certificate" or "Preview" is clicked */
function CertificateModal({ tier, repName, history, isPreview, onClose }) {
  const avg = history.length ? Math.round(history.reduce((a,h)=>a+h.overall,0)/history.length) : 0;
  // Always the date the certificate is opened — never a stored past date
  const dateStr = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  // Name: prefer the typed rep name, fall back to the visitor name saved on first login
  const displayName = (repName || "").trim()
    || (() => { try { return localStorage.getItem("sarafai_visitor_name") || ""; } catch { return ""; } })()
    || "Sales Representative";
  const certId = `OUTSKILL-L${tier.level}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const verifyUrl = `https://outskill-garvit.vercel.app/?cert=${certId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verifyUrl)}&bgcolor=ffffff&color=0a0c08&margin=6`;

  const printCert = () => {
    const w = window.open("", "_blank", "width=900,height=650");
    const el = document.getElementById("saraf-cert-inner");
    w.document.write(`<!DOCTYPE html><html><head><title>${tier.title} — ${displayName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Hanken+Grotesk:wght@400;600;700&display=swap" rel="stylesheet"/>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#0a0c08;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Hanken Grotesk',sans-serif}
      @media print{body{background:#0a0c08}@page{size:A4 landscape;margin:0}}
    </style></head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 800);
  };

  return createPortal(
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 14px", zIndex:9999, overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:820, display:"flex", flexDirection:"column", gap:16 }}>
        {/* Certificate */}
        <div id="saraf-cert-inner" style={{
          background:"#0a0c08", border:`2px solid ${tier.color}`,
          borderRadius:20, padding:"44px 52px 36px", position:"relative", overflow:"hidden",
          boxShadow:`0 0 60px ${tier.glow}, inset 0 0 80px rgba(0,0,0,0.5)`,
          fontFamily:"'Hanken Grotesk',sans-serif",
        }}>
          {/* Preview watermark */}
          {isPreview && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:2 }}>
              <div style={{ fontSize:80, fontWeight:900, color:"rgba(255,255,255,0.04)", transform:"rotate(-35deg)", userSelect:"none", letterSpacing:8, whiteSpace:"nowrap" }}>PREVIEW</div>
            </div>
          )}
          {/* corner decorations */}
          {["topleft","topright","bottomleft","bottomright"].map(pos => (
            <div key={pos} style={{
              position:"absolute",
              top: pos.includes("top") ? 14 : "auto", bottom: pos.includes("bottom") ? 14 : "auto",
              left: pos.includes("left") ? 14 : "auto", right: pos.includes("right") ? 14 : "auto",
              width:28, height:28, borderTop: pos.includes("top")?`2px solid ${tier.color}`:"none",
              borderBottom: pos.includes("bottom")?`2px solid ${tier.color}`:"none",
              borderLeft: pos.includes("left")?`2px solid ${tier.color}`:"none",
              borderRight: pos.includes("right")?`2px solid ${tier.color}`:"none",
            }}/>
          ))}

          {/* header row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,8px)", gap:3.5 }}>
                {[1,1,0,1,1,1,1,1,0].map((d,i)=>(<span key={i} style={{ width:8, height:8, borderRadius:"50%", background:d?tier.color:"transparent", border:d?"none":`1px solid rgba(255,255,255,0.15)` }}/>))}
              </div>
              <div>
                <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:tier.color, fontWeight:700 }}>OutSkill</div>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginTop:1 }}>Sales Department</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:`rgba(255,255,255,0.04)`, border:`1px solid ${tier.color}44`, borderRadius:30, padding:"6px 14px" }}>
                <span style={{ fontSize:16 }}>{tier.icon}</span>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:tier.color }}>{tier.badge}</span>
              </div>
            </div>
          </div>

          {/* main body */}
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontSize:11, letterSpacing:3, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:14 }}>This is to certify that</div>
            <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:"clamp(28px,5vw,46px)", fontWeight:700, color:"#fff", letterSpacing:-0.5, marginBottom:10, textShadow:`0 0 40px ${tier.color}66` }}>
              {displayName}
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", maxWidth:480, margin:"0 auto", lineHeight:1.65 }}>
              has successfully completed the <strong style={{color:"rgba(255,255,255,0.85)"}}>OutSkill AI Sales Mock Call Training Program</strong> and demonstrated competency in AI-assisted consultative sales techniques.
            </div>
          </div>

          {/* stats row */}
          <div style={{ display:"flex", justifyContent:"center", gap:28, marginBottom:32, flexWrap:"wrap" }}>
            {[
              { label:"Mock Calls", value: history.length },
              { label:"Average Score", value:`${avg}/100` },
              { label:"Level Achieved", value:tier.title },
              { label:"Date Issued", value:dateStr },
            ].map((s,i)=>(
              <div key={i} style={{ textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:700, color:tier.color }}>{s.value}</div>
                <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* divider */}
          <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${tier.color}44, transparent)`, marginBottom:28 }}/>

          {/* footer: signatures + QR */}
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:20 }}>
            <div style={{ display:"flex", gap:40, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:17, fontWeight:600, color:"#fff", marginBottom:4 }}>Garvit Saraf</div>
                <div style={{ width:120, height:1, background:`${tier.color}66`, marginBottom:6 }}/>
                <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)" }}>Issued by</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:2 }}>OutSkill Sales Department</div>
              </div>
              <div>
                <div style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:15, color:"rgba(255,255,255,0.5)", marginBottom:4, fontStyle:"italic" }}>OutSkill AI</div>
                <div style={{ width:120, height:1, background:`${tier.color}44`, marginBottom:6 }}/>
                <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)" }}>Training Platform</div>
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <img src={qrUrl} alt="Verify" style={{ width:80, height:80, borderRadius:8, border:`1.5px solid ${tier.color}55`, display:"block", marginBottom:6 }}/>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:1 }}>SCAN TO VERIFY</div>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.2)", marginTop:2 }}>{certId}</div>
            </div>
          </div>
        </div>

        {/* Preview notice */}
        {isPreview && (
          <div style={{ background:"rgba(232,178,75,0.12)", border:"1px solid rgba(232,178,75,0.45)", borderRadius:12, padding:"11px 18px", textAlign:"center", fontSize:13, color:"#f0d29a" }}>
            <b>Preview mode</b> — this is exactly what your certificate will look like once you earn it. Complete {tier.calls} mock calls with an average score of {tier.minAvg}+ to unlock the real one.
          </div>
        )}

        {/* action buttons */}
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          {!isPreview && (
            <button onClick={printCert} style={{ ...primaryBtn, gap:8 }}>
              <span>⬇</span> Download / Print Certificate
            </button>
          )}
          <button onClick={onClose} style={{ ...secondaryBtn }}>Close</button>
        </div>
      </div>
    </div>
  , document.body);
}

/* Certificates section inside PersonalProgress */
function CertificatesSection({ history, repName, serif }) {
  const [openTier, setOpenTier] = useState(null);
  const [previewTier, setPreviewTier] = useState(null);
  const avg = history.length ? Math.round(history.reduce((a,h)=>a+h.overall,0)/history.length) : 0;
  const previewName = repName || "Your Name";

  return (
    <div style={{ marginBottom:20 }}>
      {/* Section header explaining the certificate system */}
      <div style={{ marginBottom:12 }}>
        <SectionLabel>Certificates & Badges</SectionLabel>
        <div style={{ fontSize:13, color:MUTE, lineHeight:1.6, maxWidth:620 }}>
          Complete mock calls with a qualifying average score to earn a real certificate — issued by <b style={{color:TXT}}>Garvit Saraf · OutSkill Sales Department</b>, with a QR code you can download, print, or share. Three tiers, each harder to earn.
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {CERT_TIERS.map(tier => {
          const earned = certEarned(tier, history);
          const callPct = Math.min(100, (history.length / tier.calls) * 100);
          const avgPct = Math.min(100, ((avg||0) / tier.minAvg) * 100);
          const callsDone = Math.min(history.length, tier.calls);
          const callsLeft = Math.max(0, tier.calls - history.length);
          const scoreGap = Math.max(0, tier.minAvg - (avg||0));

          return (
            <div key={tier.id} style={{
              background: earned
                ? `rgba(${tier.id==="certified"?"194,238,69":tier.id==="intermediate"?"176,184,193":"205,127,50"},0.07)`
                : PANEL,
              border:`1px solid ${earned ? tier.color+"66" : BORDER}`,
              borderRadius:16, padding:"16px 18px",
            }}>
              {/* Top row: icon + title + action button */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <span style={{ fontSize:32, lineHeight:1, filter: earned?"none":"grayscale(1) opacity(0.35)", marginTop:2 }}>{tier.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  {/* Title row */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                    <span style={{ fontWeight:700, color: earned?tier.color:TXT, fontSize:15 }}>{tier.title}</span>
                    <span style={{ fontSize:10, letterSpacing:1.2, textTransform:"uppercase",
                      color: earned?tier.color:MUTE,
                      background: earned?`${tier.color}18`:"rgba(255,255,255,0.05)",
                      border:`1px solid ${earned?tier.color+"44":BORDER}`,
                      borderRadius:20, padding:"2px 8px" }}>
                      {tier.badge}
                    </span>
                    {earned && <span style={{ fontSize:11, color:LIME_DIM, fontWeight:600 }}>✓ Earned</span>}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize:12.5, color: earned?TXT:MUTE, lineHeight:1.55, marginBottom:8 }}>{tier.desc}</div>

                  {/* Requirement pill */}
                  <div style={{ fontSize:11.5, color:MUTE, marginBottom: !earned ? 10 : 0 }}>
                    Requires <b style={{color:TXT}}>{tier.calls} mock calls</b> with an <b style={{color:TXT}}>average score ≥ {tier.minAvg}</b>
                    {earned
                      ? <span style={{ color:LIME_DIM, marginLeft:8 }}>· You've met both requirements.</span>
                      : callsLeft === 0 && scoreGap > 0
                        ? <span style={{ color:"#e8b24b", marginLeft:8 }}>· Calls ✓ — need {scoreGap} more avg points</span>
                        : callsLeft > 0 && scoreGap === 0
                          ? <span style={{ color:"#e8b24b", marginLeft:8 }}>· Score ✓ — need {callsLeft} more call{callsLeft>1?"s":""}</span>
                          : !earned
                            ? <span style={{ color:MUTE, marginLeft:8 }}>· {callsDone}/{tier.calls} calls · {avg||0}/{tier.minAvg} avg</span>
                            : null
                    }
                  </div>

                  {/* Progress bars (locked only) */}
                  {!earned && (
                    <div style={{ display:"flex", gap:10, marginBottom:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:MUTE, marginBottom:3 }}>
                          <span>Calls</span><span>{callsDone}/{tier.calls}</span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${callPct}%`, background:tier.color, borderRadius:3, transition:"width .8s ease" }}/>
                        </div>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:MUTE, marginBottom:3 }}>
                          <span>Avg score</span><span>{avg||0}/{tier.minAvg}</span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${avgPct}%`, background:tier.color, borderRadius:3, transition:"width .8s ease" }}/>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display:"flex", flexDirection:"column", gap:7, flexShrink:0 }}>
                  {earned ? (
                    <button onClick={()=>setOpenTier(tier)}
                      style={{ ...primaryBtn, padding:"9px 16px", fontSize:13, background:tier.color, color:tier.id==="certified"?INK:"#0a0c08" }}>
                      View Certificate
                    </button>
                  ) : (
                    <button onClick={()=>setPreviewTier(tier)}
                      style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, color:tier.color,
                        background:`${tier.color}12`, border:`1px solid ${tier.color}44`, borderRadius:30, padding:"7px 14px", fontWeight:600 }}>
                      <span>👁</span> Preview
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Earned: real certificate with actual data */}
      {openTier && (
        <CertificateModal tier={openTier} repName={repName} history={history} onClose={()=>setOpenTier(null)}/>
      )}
      {/* Preview: certificate with sample data so they know exactly what they're working toward */}
      {previewTier && (
        <CertificateModal
          tier={previewTier}
          repName={previewName}
          history={Array.from({length:previewTier.calls}, (_,i)=>({ overall: previewTier.minAvg + Math.floor(Math.random()*10) }))}
          isPreview
          onClose={()=>setPreviewTier(null)}
        />
      )}
    </div>
  );
}
const errStyle = { background:"rgba(232,122,107,0.1)", border:"1px solid rgba(232,122,107,0.4)", color:"#f3cabf", borderRadius:12, padding:"11px 14px", fontSize:13.5, marginTop:12 };
const chip = active => ({ display:"inline-flex", alignItems:"center", background: active?LIME:PANEL, color: active?INK:TXT, border:`1px solid ${active?LIME:BORDER}`, borderRadius:12, padding:"11px 13px", fontSize:13.5, fontWeight:500 });

function scoreColor(v){ return v>=80?LIME:v>=60?"#e8d24b":v>=40?"#e8a94b":"#e87a6b"; }
function barColor(r){ return r>=0.8?LIME:r>=0.55?"#d8e84b":r>=0.35?"#e8a94b":"#e87a6b"; }
function scoreVerdict(v){ return v>=85?"Strong call.":v>=70?"Solid, with room to sharpen.":v>=50?"Some good instincts — key gaps to fix.":"Let's rebuild the fundamentals."; }

/* Reusable full scorecard report — used in the team detail view. Takes a
   normalized card object plus light meta. */
function ScorecardReport({ card, serif, title, sub, duration }) {
  if (!card) return <div style={{ color:MUTE, fontSize:13.5 }}>No detailed report was saved for this call.</div>;
  const score = card.overall;
  const scoreCol = scoreColor(score);
  const routedRight = card.correctRouting;
  return (
    <div>
      <div style={{ background:`linear-gradient(135deg, rgba(194,238,69,0.07) 0%, rgba(10,12,8,0) 60%)`, border:`1px solid ${BORDER}`, borderRadius:18, padding:"20px 20px 16px", marginBottom:16, display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
        <Ring value={score}/>
        <div style={{ flex:1, minWidth:180 }}>
          {sub && <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:MUTE, marginBottom:4 }}>{sub}</div>}
          <h2 style={{ ...serif, fontSize:24, fontWeight:600, margin:"0 0 10px", color:scoreCol }}>{title || scoreVerdict(score)}</h2>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Pill ok={routedRight}>{routedRight ? <CheckCircle2 size={13}/> : <XCircle size={13}/>}<span style={{marginLeft:5}}>Routed → {card.recommendedProgram}{routedRight?" ✓":" ✗"}</span></Pill>
            {duration && <Pill neutral><Clock size={12}/><span style={{marginLeft:5}}>{duration}</span></Pill>}
          </div>
        </div>
      </div>

      {card.flags && card.flags.length > 0 && (
        <div style={{ background:"rgba(232,122,107,0.08)", border:"1px solid rgba(232,122,107,0.4)", borderRadius:14, padding:"13px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#f0a594", fontWeight:700, fontSize:13, marginBottom:6 }}><AlertTriangle size={15}/> Critical flags</div>
          {card.flags.map((f,i)=>(<div key={i} style={{ fontSize:12.5, color:"#f3cabf", marginTop:4, paddingLeft:8, borderLeft:`2px solid rgba(232,122,107,0.5)` }}>• {f}</div>))}
        </div>
      )}

      <Panel title="Category breakdown">
        {card.categories.map((c,i)=>{ const pct=c.score/c.max; return (
          <div key={i} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
              <span style={{ fontWeight:500 }}>{c.name}</span>
              <span style={{ color:MUTE }}><b style={{ color:barColor(pct), fontSize:15 }}>{c.score}</b><span style={{fontSize:11}}>/{c.max}</span></span>
            </div>
            <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}><div style={{ height:"100%", width:`${pct*100}%`, background:barColor(pct), borderRadius:6 }}/></div>
          </div>
        );})}
      </Panel>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12, marginTop:12 }}>
        <ListPanel title="✓ What went well" items={card.strengths} icon={<CheckCircle2 size={15} color={LIME_DIM}/>} color={LIME_DIM}/>
        <ListPanel title="✗ Where points were lost" items={card.lostPoints} icon={<Target size={15} color="#e8b24b"/>} color="#e8b24b"/>
        <ListPanel title="◎ Missed opportunities" items={card.missed} icon={<Sparkles size={15} color="#7bb8e8"/>} color="#7bb8e8"/>
        <ListPanel title="💬 Say this next time" items={card.sayNextTime} icon={<ChevronRight size={15} color={LIME}/>} color={LIME} quote/>
      </div>

      {card.behavioral && (
        <Panel title="Behavioral read" style={{ marginTop:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, fontSize:13.5 }}>
            <Meta k="Pace" v={card.behavioral.pace}/>
            <Meta k="Tone" v={card.behavioral.tone}/>
            <Meta k="Talk-time balance" v={card.behavioral.talkTime}/>
            <Meta k="Red flags" v={card.behavioral.redFlags}/>
          </div>
        </Panel>
      )}
    </div>
  );
}
