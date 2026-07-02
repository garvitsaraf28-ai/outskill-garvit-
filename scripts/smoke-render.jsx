// Full-app smoke test: server-renders EVERY screen with realistic props.
// Catches undefined variables, broken props, and bad JSX in screens that the
// build alone can't verify (Vite doesn't execute components).
// Run: npm run smoke
import React from "react";
import { renderToString } from "react-dom/server";
import App, { Setup, CallView, Feedback } from "../src/App.jsx";
import { LoginScreen, Dashboard, StagePage, STAGES, MastermindRecordings, ManagerView } from "../src/journey.jsx";

const serif = { fontFamily: "serif" };
const noop = () => {};
let pass = 0, fail = 0;

function check(name, fn, mustContain) {
  try {
    const html = renderToString(fn());
    if (!html || html.length < 40) throw new Error(`suspiciously empty output (${html.length} chars)`);
    // SSR quirks: strip React's text-segment markers; match either raw or HTML-escaped text.
    const plain = html.replaceAll("<!-- -->", "");
    const escaped = mustContain ? mustContain.replaceAll("&", "&amp;") : "";
    if (mustContain && !plain.includes(mustContain) && !plain.includes(escaped)) {
      throw new Error(`missing expected text: "${mustContain}"`);
    }
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ❌ ${name} — ${e.message}`);
    fail++;
  }
}

const user = { name: "Test Rep", email: "rep@outskill.com", role: "New joiner" };
const history = [
  { date: Date.now(), persona: "Rajesh", personaTag: "PM · Bengaluru", mode: "learner", rep: "Test Rep", difficulty: "Peer · Standard", duration: "4:20", overall: 78, correctRouting: true,
    categories: [{ name: "Opening & rapport", pct: 80 }, { name: "Discovery & qualification", pct: 70 }, { name: "Objection handling", pct: 60 }, { name: "Close & next step", pct: 75 }] },
  { date: Date.now() - 86400000, persona: "Meena", personaTag: "Finance · Gurugram", mode: "learner", rep: "Test Rep", difficulty: "Senior · Advanced", duration: "6:01", overall: 64, correctRouting: true,
    categories: [{ name: "Opening & rapport", pct: 66 }, { name: "Discovery & qualification", pct: 58 }, { name: "Objection handling", pct: 55 }, { name: "Close & next step", pct: 60 }] },
];
const persona = { id: "p1", name: "Rajesh", gender: "male", tag: "Program Manager · Bengaluru", route: "Generalist", mood: "Analytical", ttsLang: "en-IN",
  lead: "Attended the mastermind.", stated: '"I can learn on YouTube."', blocker: "Career insurance.", brief: "You are Rajesh..." };
const card = {
  overall: 78, recommendedProgram: "Generalist", correctRouting: true, flags: [],
  categories: [
    { name: "Opening & rapport", score: 8, max: 10 }, { name: "Discovery & qualification", score: 14, max: 20 },
    { name: "Program routing & fit", score: 12, max: 15 }, { name: "Value framing", score: 11, max: 15 },
    { name: "Objection handling", score: 14, max: 20 }, { name: "Pricing, EMI & trust", score: 9, max: 10 },
    { name: "Close & next step", score: 8, max: 10 },
  ],
  strengths: ["Warm opening", "Good discovery"], lostPoints: ["Weak close"], missed: ["Didn't isolate the blocker"],
  sayNextTime: ["If budget weren't an issue, is this a yes?"],
  behavioral: { pace: "Good", tone: "Warm", talkTime: "Balanced", redFlags: "None" },
};
const voice = { on: false, listening: false, speaking: false, busy: false, interim: "", blocked: false,
  handsFree: true, setHandsFree: noop, onMicTap: noop, enVoices: [], voiceURI: "", setVoiceURI: noop,
  rate: 1, setRate: noop, enable: noop, disable: noop, sttSupported: false, ttsSupported: false };
const messages = [
  { role: "user", content: "Hi Rajesh, this is Test from OutSkill — you attended our mastermind yesterday, right?" },
  { role: "assistant", content: "Yeah, I did. Honestly I'm not sure I need a paid course though." },
];

console.log("— Entry & auth —");
check("App (cover splash)", () => <App />, "deal-closer");
check("LoginScreen (signup)", () => <LoginScreen onAuth={noop} onBack={noop} onManager={noop} />, "Create your account");

console.log("— Dashboard —");
check("Dashboard home (new user)", () => <Dashboard user={user} completed={[]} goStage={noop} onLogout={noop} history={[]} onManager={noop} />, "Welcome, Test");
check("Dashboard home (mid-journey)", () => <Dashboard user={user} completed={[2,3,4]} goStage={noop} onLogout={noop} history={history} onManager={noop} />, "Manager view");
check("Dashboard report (empty)", () => <Dashboard user={user} completed={[]} goStage={noop} onLogout={noop} history={[]} onManager={noop} initialView="report" />, "readiness report");
check("Dashboard report (with data)", () => <Dashboard user={user} completed={[2,3,4,5,6,7]} goStage={noop} onLogout={noop} history={history} onManager={noop} initialView="report" />, "Selling skills");

console.log("— All 12 level pages —");
for (const s of STAGES) {
  check(`StagePage L${s.n - 1 >= 1 ? s.n - 1 : 0} · ${s.title} (open)`, () => <StagePage stage={s} isDone={false} onComplete={noop} goDashboard={noop}>{null}</StagePage>, s.title);
  check(`StagePage · ${s.title} (done)`, () => <StagePage stage={s} isDone={true} onComplete={noop} goDashboard={noop}>{null}</StagePage>);
}

console.log("— Level 2 content —");
check("MastermindRecordings (videos)", () => <MastermindRecordings />, "Generalist mastermind");
check("MastermindRecordings (brochures)", () => <MastermindRecordings initialStep="brochures" />, "brochures");

console.log("— Mock-Call Room (the heart) —");
check("Setup (learner mode)", () => <Setup serif={serif} mode="learner" setMode={noop} persona={persona} setPersona={noop}
  useCustom={false} setUseCustom={noop} custom="" setCustom={noop} startCall={noop} history={history}
  voiceWanted={false} setVoiceWanted={noop} sttSupported={true} ttsSupported={true}
  repName="Test Rep" setRepName={noop} round={1} setRound={noop} hintMode="standard" setHintMode={noop}
  learnedFacts={["The Accelerator costs Rs 94,999"]} clearLearnedFacts={noop} />, "Hint mode");
check("Setup (agent mode)", () => <Setup serif={serif} mode="agent" setMode={noop} persona={persona} setPersona={noop}
  useCustom={false} setUseCustom={noop} custom="" setCustom={noop} startCall={noop} history={[]}
  voiceWanted={false} setVoiceWanted={noop} sttSupported={false} ttsSupported={false}
  repName="" setRepName={noop} round={4} setRound={noop} hintMode="senior" setHintMode={noop}
  learnedFacts={[]} clearLearnedFacts={noop} />);
check("CallView (mid-call)", () => <CallView serif={serif} mode="learner" persona={persona} messages={messages} busy={false}
  input="" setInput={noop} send={noop} seconds={125} endCall={noop} err="" scrollRef={React.createRef()} voice={voice}
  letThemOpen={noop} callStage={2} totalStages={6} hint="💡 Ask about their background" setHint={noop} mood="interested" />, "Rajesh");
check("CallView (busy + error)", () => <CallView serif={serif} mode="learner" persona={persona} messages={messages} busy={true}
  input="hello" setInput={noop} send={noop} seconds={10} endCall={noop} err="That turn didn't go through: test" scrollRef={React.createRef()} voice={voice}
  letThemOpen={noop} callStage={0} totalStages={6} hint="" setHint={noop} mood="neutral" />);
check("Feedback (grading spinner)", () => <Feedback serif={serif} mode="learner" persona={persona} card={null} cardRaw=""
  grading={true} err="" reset={noop} again={noop} duration="4:20" useCustom={false} repName="Test Rep" />);
check("Feedback (scorecard)", () => <Feedback serif={serif} mode="learner" persona={persona} card={card} cardRaw=""
  grading={false} err="" reset={noop} again={noop} duration="4:20" useCustom={false} repName="Test Rep" />, "78");
check("Feedback (raw fallback)", () => <Feedback serif={serif} mode="learner" persona={persona} card={null} cardRaw="{ overall: 70 }"
  grading={false} err="" reset={noop} again={noop} duration="4:20" useCustom={false} repName="Test Rep" />);
check("Feedback (error)", () => <Feedback serif={serif} mode="learner" persona={persona} card={null} cardRaw=""
  grading={false} err="Couldn't generate the scorecard" reset={noop} again={noop} duration="4:20" useCustom={false} repName="Test Rep" />);

console.log("— Manager —");
check("ManagerView (sign-in)", () => <ManagerView onBack={noop} />, "Managers only");

console.log(`\n${fail === 0 ? "🟢" : "🔴"} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
