# Bootcamp Session — AI Workflows (prompting, automation thinking, tool chains)

Gen AI Bootcamp — Session Notes
### From Prompts to AI
### Workflows
Learn one simple workflow you can use tomorrow —
then see where it can go.
👤 Session led by — Dileep Karri
🎯 Goal — one reliable workflow you can use immediately, plus the
advanced version for high-stakes work
👥 For — first-time and early AI workflow users
Gen AI Bootcamp · Detailed Session Notes

### H O W T O R E A D T H E SE N O T E S
### The Thesis of the Session
These notes follow the session Dileep Karri led on moving from one-off prompts to
repeatable AI workflows. They are written so you can rebuild everything yourself: every
prompt is reproduced verbatim, every comparison is kept, and the analogies used in the
room are included because they are the part that makes the ideas stick.
One sentence carries the whole session: you do not need to become an AI expert — you
need one good prompt and the judgment to know when to go deeper. Everything below is
in service of that.
### PA R T 1
You Already Know How to Prompt.
Now Learn How to Think.
A single prompt gives you an answer. A workflow gives you a reliable outcome. That is the
entire shift this session is about — and it is a shift in thinking, not in tools.
Random prompting 	Workflow approach
“Analyze this data” 	A precise question, a checked output, a clear
action
A different result every time 	Repeatable quality
No way to improve it 	Clear steps to refine
Hard to explain to others 	Easy to hand off and teach
### THE FRA MI NG
A single prompt is like asking a stranger one question and walking away. A workflow is like
having a process — same input quality, same output quality, every time.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 1

The problem with “Analyze this data”
You upload a spreadsheet and type “analyze this and tell me what you find.” Back comes a
generic chart, an obvious observation, and no decision. The reason is simple: you never told
the AI what decision you are trying to make — and you might not yet know how to frame
that yourself.
The fix is not a harder prompt. It is making the AI do the hard part: asking you the right
questions first.
### THE D OCTOR A NA LOGY
Walking up and saying “analyze this data” is like walking into a doctor's office and saying “fix
me.” A bad doctor guesses. A good doctor takes your history first. The skill isn't asking better
questions — it's hiring something that asks them for you.
### PA R T 2
The Analyst Prompt — Your Everyday
### Workflow
Instead of you framing the perfect question, you paste one prompt that turns Claude into a
senior analyst. It does what a good consultant does: it interviews you first, waits for your
answers, and only then delivers a structured, executive-ready analysis. You do not need to
know the framework — the prompt carries it for you.
### WHY THI S MATTE RS
The difference between a junior hire who runs off and does something the moment you ask,
and a consultant who first sits you down and asks “what decision are you actually trying to
make?” The second is worth ten times more. This one prompt rents you that second person.
“Simple” doesn't mean “weak” — it means the effort is hidden inside the prompt, not loaded
onto you.
The Analyst Prompt — copy and use
### PA STE THI S I NTO CLA U D E WI TH YOU R D ATA
You are a senior McKinsey-style analyst. I am going to give you some data
(or describe a decision). Do NOT analyze anything yet.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 2

FIRST, interview me. Ask me up to 6 sharp clarifying questions, in one batch,
to understand:
- The decision I'm actually trying to make
- What a good outcome looks like (the metric that matters)
- The scope (time period, segment, geography)
- What I already know and what data I have
- Any constraints or assumptions you should respect
WAIT for my answers.
THEN deliver your analysis in this structure:
1. Executive Summary - the answer and why, in 5 lines
2. What the Data Shows - key findings with the numbers behind them
3. What This Means - implications and risks
4. Recommendation - one clear action, expected impact, main risk, first step
5. What I'm Not Sure About - weakest assumptions and what would change the answer
Keep it crisp. No filler. Use plain language a busy executive understands.
### The two power lines
“Do NOT analyze anything yet” and “WAIT for my answers.” Those two sentences
are what stop the AI from running off. You paste this prompt once and never write
it again.
### Why it works
Without the Analyst Prompt 	With it
You must know what to ask 	The AI asks you
You get a generic data dump 	You get a decision
A different structure every time 	The same five-part structure every time
Easy to fool yourself 	“What I'm Not Sure About” forces honesty
The trick is that you moved the hard thinking from you to the prompt.
### TWO A NA LOGI E S THAT LA ND E D
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 3

“Analyze this data” is throwing random ingredients in a pan and hoping. The Analyst Prompt
is a recipe card — same dish, every cook, every time. And the last section, “What I'm Not Sure
About,” is the AI's confession box: most people never ask AI what it's unsure about, so it never
tells them. This prompt makes it mandatory.
The live demo — what to watch for
The demo needs no setup, no plugins — just Claude and a file:
The moment that earns trust is when Claude fires its questions back at you — it is
interviewing you, exactly as the prompt promised — and again when it openly states its
weakest assumptions.
### PA R T 3
ACR — The Advanced Workflow
The Analyst Prompt is your everyday tool. ACR is what you graduate into — not where you
start. Reach for it when the decision involves serious money, people, or deadlines; when
you need to audit every step rather than trust one output; or when you will run the process
repeatedly and want it fixed and teachable.
### A U TOMATI C VS MA NU A L
The Analyst Prompt is an automatic car — it gets you anywhere with no thinking about gears.
ACR is manual transmission — more effort, but full control when the road gets serious. You do
not need ACR for most things.
### The three steps
Three deliberate steps, and you drive each one:
Upload a real dataset (CSV/Excel) straight into Claude.	1.
Paste the Analyst Prompt.	2.
Answer the clarifying questions Claude asks back — even imperfectly; it still works.	3.
Read the structured analysis it produces, and scroll to “What I'm Not Sure About.”	4.
A = Ask — frame the question yourself: decision, metric, scope.
C = Check — make the AI argue against its own answer.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 4

Where the Analyst Prompt does this for you, ACR makes you do it by hand — which is
exactly the point when the stakes are high and someone will challenge your numbers in a
room.
A = Ask
You frame the question with the decision, metric and scope named explicitly.
### THE A SK TE MPLATE
You are a business analyst helping me make a specific decision.
DECISION: [What action am I choosing between?]
METRIC: [What number tells me if this worked?]
SCOPE: [Time period + segment + geography]
CONTEXT: [What do I already know? What data do I have?]
Return:
1. A single, precise analysis question
2. Three sub-questions that support it
3. The data fields I need
4. What a strong answer looks like vs a weak one
Weak ask: “Analyze this dataset.” Strong ask: names the decision, the metric, and the
scope. A fully worked example used in the room:
WORK E D E XA MPLE — A RE A L SA LE S D E CI SI ON
You are a business analyst helping me make a specific sales decision.
### I have an online sales dataset with 240 transactions from
Jan 1, 2024 to Aug 27, 2024.
The dataset fields are: Transaction ID, Date, Product Category,
Product Name, Units Sold, Unit Price, Total Revenue, Region, Payment Method.
Product categories: Electronics, Home Appliances, Clothing, Books,
Beauty Products, Sports.
Regions: North America, Europe, Asia.
DECISION:
Which product category and region should we prioritize for growth
in the next quarter?
R = Recommend — force the insight into one executive action.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 5

METRIC:
Total Revenue, supported by Units Sold and average revenue per transaction.
SCOPE:
Jan 1, 2024 to Aug 27, 2024, across all regions, categories,
and payment methods.
CONTEXT:
We want to identify where the strongest revenue opportunities are -
which categories generate the most revenue, which regions are
strongest, and whether any category-region combinations look
especially promising.
Return:
1. A single, precise analysis question
2. Three sub-questions that support it
3. The data fields needed to answer each sub-question
4. What a strong answer would look like vs a weak answer
### THE RE STA U RA NT A NA LOGY
“Bring me food” versus “I want the grilled fish, no butter, lemon on the side, in 20 minutes.”
Same kitchen, wildly different result. With the Analyst Prompt the AI asked these questions for
you; here, you write them — more work, more precision, more control.
C = Check
After the analysis, you make the AI proofread itself.
### THE CHE CK TE MPLATE
Review your previous analysis critically.
1. What are the 3 weakest assumptions you made?
2. What data would change your conclusion if it were different?
3. Rate your confidence: High / Medium / Low for each insight
4. What did you NOT consider that might matter?
5. If someone argued against your conclusion, what's their strongest point?
If it rates everything “High confidence,” push back: “Be more honest. What are you least
sure about and why?”
### THE PROOFRE A D I NG A NA LOGY
You don't trust the first draft of an email to your boss — you reread it with a critic's eye. The
Check step makes the AI proofread itself. You're asking it to argue against itself, and it's
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 6

surprisingly good at it, if you make it.
R = Recommend
Analysis without a recommendation is just trivia.
### THE RE COMME ND TE MPLATE
Based on the analysis and the self-critique, create an
executive recommendation.
RECOMMENDED ACTION: [One sentence. What should we do?]
WHY NOW: 	[2-3 sentences. Why this, why now?]
EXPECTED IMPACT: [Metric + estimated range]
MAIN RISK: 	[What could go wrong + mitigation]
NEXT STEP: 	[One concrete action for the next 48 hours]
Under 200 words. No jargon. Understandable in 30 seconds.
Every recommendation needs four parts: Action, Impact, Risk, Next step.
### WE ATHE R RE PORT VS U MBRE LLA
“70% chance of rain” is analysis. “Take the umbrella, leave by 8” is a recommendation. Most
AI output stops at the weather report — R forces it to hand you the umbrella. The bar: could you
forward it to your manager right now?
The full cycle — and the real skill
Run Ask → Check → Recommend end to end: upload a dataset, frame the Ask, run
the Check, produce the Recommendation. Both the Analyst Prompt and ACR are
valid — choosing the right one is the actual skill. Simple prompt for most days. ACR
for the day it really matters.
### PA R T 4
### The AI Multi-Tool Workflow
So far everything lived inside one AI. But no single AI tool is the best at everything. The
magic happens when you combine the right tools for the right jobs — like assembling a
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 7

team of specialists instead of relying on one generalist. You wouldn't hire one person to
design, research, and analyze; you'd hire a team.
What you'll build: a research-backed strategy output (a slide deck, report, or plan)
grounded in real data, styled in your brand's look, and structured the way a consultant
would deliver it. The same framework answers “what product to launch,” “which market to
enter,” “how to position against competitors,” or “what content strategy to follow.”
The framework: 3 roles, 3 tools
Role 	Tool 	What it does
🎨 The Designer 	Gemini 	Captures your brand's look and feel
🔍 The
### Researcher
Perplexity / ChatGPT 	Browses the internet, finds fresh data
🧠 The Analyst 	NotebookLM 	Synthesizes everything, gives structured
answers
🎨
### Designer
### Gemini
Capture brand look
→
🔍
### Researcher
### Perplexity
Research the market
→
🧠
### Analyst
### NotebookLM
### Analyse & build deck
### WHY THE ORD E R I S FI XE D
You decorate the house (brand identity) before you decide what furniture to buy (research)
before you arrange the room (analysis). Out of order means redoing work. Say it back:
“Designer, Researcher, Analyst — in that order, every time.”
### The six steps
Step 1 — Capture your brand identity
Tool · Gemini (gemini.google.com)
Share your website URL and ask Gemini to read it and produce a reusable style guide:
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 8

"Look at this website - [URL]. Analyse the brand's design language,
colour palette, typography, tone of voice, and overall personality.
Summarise it as a style guide I can reuse."
Save the output — you need it in Step 5. This is your brand's fingerprint; skip it and every
output looks like a stranger made it. Thirty seconds now saves an hour of “this doesn't feel
like us” later.
Step 2 — Gather research
Tool · Perplexity.ai (or ChatGPT with browsing, or Gemini Deep Research)
"I run [your business - URL]. Research my competitors, market trends,
pricing, and customer pain points. Summarise with sources."
Copy and save the full output — text and source links. Why separately? NotebookLM
cannot browse the internet; you bring the research to it.
### THE LI BRA RY A NA LOGY
NotebookLM is a brilliant analyst locked in a library with no internet — it can only reason
about what you carry into the room. Perplexity is the runner who goes outside and brings back
today's newspaper. Don't skip the runner.
Step 3 — Load everything into NotebookLM
Tool · NotebookLM (notebooklm.google.com)
Create a notebook and add as sources:
Think of each source as adding another expert to the room. A panel of one is an opinion; a
panel of six with citations is a briefing. Quality over quantity, though — junk sources add a
loud, wrong voice.
### Your company website URL
The Perplexity research (paste as a Note, then convert to a Source)
The brand style guide from Step 1 (same: Note → Source)
Any extra material — competitor sites, reports, reviews
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 9

Step 4 — Configure the notebook voice
⚠ This is the step most people skip. Don't.
This is the single highest-leverage step. It is the briefing you would give a new hire
on day one. Skip it and you get a generic AI; do it and you get your consultant.
Open Settings / Configure and paste this, replacing the bracketed parts:
### NOTE BOOK LM CONFI GU RATI ON PROMPT
### ROLE
You are a strategy consultant for [YOUR BRAND NAME],
a [one-line brand description, e.g. "premium kitchen appliance brand in India"].
You are structured, data-driven, and give clear recommendations.
RULES
- Only use the sources provided. Do not make things up.
- Use numbers and citations wherever possible.
- Keep language crisp. Short paragraphs, clear headings, no filler.
- If information is missing, say so and suggest what data to collect.
- When making slides, follow the brand design language from the sources.
WHEN I ASK FOR AN ANALYSIS, STRUCTURE IT AS:
1. Executive Summary - what to do and why (10 lines max)
2. Market Map - how the market is segmented and where the money is
3. Competitor Landscape - who competes and how they're positioned
4. Customer Insights - what customers want and what frustrates them
5. Recommendations - 2-3 options ranked by priority with reasons
6. Scoring Table - rate each option (1-5): market size, brand fit,
differentiation, profitability, speed to launch
7. Open Questions - what still needs answers before deciding
Step 5 — Ask your questions
Ask in this order — big picture first, then narrow:
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 10

# 	Ask this 	You get
1 	“Give me a full analysis.” 	The structured report from your prompt
2 	“What should we do next? Rank options in
a table.”
Prioritised recommendations
3 	“Create a slide deck on this for my CEO.
Use the brand design language.”
Strategy deck in your brand's style
4 	“What are the biggest risks of [Option X]?” 	Risk analysis with mitigations
5 	“Summarise what customers are saying.” 	Voice-of-customer summary
Deck format tip: ask for a “detailed deck” for internal teams (more data), or “presenter
slides” for live talks (fewer slides, bigger points). Asking “what are the risks” before “what
are the options” is like asking about side effects before you've picked the medicine.
Step 6 — Export and share
The output isn't trapped; it travels into the tools you already use. And the loop is reusable:
next quarter, same notebook, add fresh research, ask again. You built an asset, not a one-
off.
Slide deck? Copy into Google Slides or PowerPoint, then apply the Step 1 brand guide.
Document? Copy into Google Docs and share.
Need more depth? Add more sources anytime — the notebook gets smarter with every
source.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 11

### Why the multi-tool approach works
Problem with one tool 	How multi-tool solves it
AI makes things up 	NotebookLM only uses YOUR sources — near-zero
hallucination
Output looks generic 	Gemini captures your real brand identity first
Research is shallow 	Perplexity browses the live internet for fresh data
Analysis is unstructured 	The configured prompt forces consultant-level
structure
Each tool covers another tool's blind spot. That is the entire reason multi-tool beats single-
tool.
### Adapt this to any problem
Your problem 	Designer step 	Researcher step 	Analyst step
Product to launch? 	Brand style
guide
Competitor & market
research
Launch
recommendations
Content to create? 	Brand tone of
voice
Trending topics &
audience data
### Content calendar
Enter a new
market?
Brand
positioning
Market size &
regulations
### Entry strategy
Improve pricing? 	Current pricing
page
Competitor pricing &
reviews
Pricing
recommendations
### One rule to remember
“Designer, Researcher, Analyst — in that order, every time.” 🎨 → 🔍 → 🧠. Total
time: roughly 30–45 minutes for a strategy deck that would take days manually.
That is the line people repeat to a colleague.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 12

### PA R T 5
From Copy-Paste to Connected:
### Connectors
Right now your AI lives in a box. To use it with real work you become the courier: open
Drive, find the file, download it; open the AI, upload it, get the analysis; open Slides, rebuild
it by hand; copy-paste back and forth between tabs. You are the middleman. Connectors
remove the middleman.
A connector lets the AI reach into an app directly — read your Drive, draft in Gmail, build in
Canva — instead of you shuttling files around. It is one standard, originally proposed by
Anthropic (makers of Claude), now adopted by ChatGPT, Gemini and others. Connect once,
works everywhere — like a universal adapter for AI.
### THE U NI VE RSA L A D A PTE R
Before, every country (app) needed its own custom plug — exhausting, breaks constantly.
Connectors are the one adapter that fits every socket. It's plumbing — you don't need to
understand plumbing to turn on a tap.
### Setting it up
On Claude 	On ChatGPT (paid plan)
Open Claude.ai 	Open ChatGPT
Click Tools → Add Connectors 	Settings → Connectors (or Add Sources in a
chat)
Browse connectors (Drive, Notion, Canva,
Gmail…)
Pick the app (Drive, SharePoint, GitHub…)
Click Connect on the app you want 	Click Connect and authenticate
Authenticate (log in, approve access) 	Reference the connected source in your
prompt
Done — Claude auto-detects which
connector to use
### Same idea, two platforms
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 13

The magic moment is that you don't say “use the Drive connector ” — you just say
“summarize my latest Drive file” and it figures out which key to use. A good assistant
doesn't ask “which filing cabinet?” — they just know.
### What you can connect
Common connectors: Google Drive, Gmail, Canva, Notion, Slack, GitHub, Stripe, and more.
Claude 	ChatGPT
Free tier 	Yes (limited) 	No — paid only
Paid (~$20/mo) 	More usage +
connectors
Connectors
included
Auto-detects connector 	Yes 	Partial
The honest framing: if your company already pays for one of these, you already have this —
most people just never turned it on. In a live demo, the point is the absence of work — no
download, no upload, no copy-paste. That is three steps gone from every task you do.
⚠ Safety & privacy — three rules before you connect anything
### PA R T 6
Allow Once, not Always. Start with the one-time option; widen access only
after you trust it. It's a houseguest's day pass, not a permanent key to your
home.
Verify before you act. Read AI-written emails and messages before they send.
Never auto-send.
Mind the tier. Free plans may use your data for training. Don't connect
confidential company data on free tiers; use paid or enterprise for sensitive
work.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 14

### Pulling It Together
### Common mistakes and fixes
Mistake 	Fix
Starting with “analyze this data” 	Use the Analyst Prompt — let the AI
interview you first
Trusting the first AI output 	Make it critique itself (the Check step)
Analysis with no action 	End every analysis with a recommendation
Skipping the NotebookLM config step 	Always brief your AI consultant before
asking
Connecting 10 apps at once 	Start with one connector; add more later
Sharing sensitive data on free plans 	Check the plan's privacy policy first
If you fix only one habit, replace “analyze this data” with the Analyst Prompt.
### Workflows vs agents
Workflow (today) 	Agent (what comes next)
You control 	Every step 	The goal only
Path 	Predefined by you 	AI decides dynamically
Best for 	Repeatable tasks 	Ambiguous, multi-step problems
Risk 	Low — you check everything 	Higher — AI makes more decisions
Start here? 	Yes 	Not yet
Master workflows first. Agents come after you trust the process — you learn the recipe
before you trust the chef.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 15

### K E E P T H I S
### Quick Reference Card
Everyday — The Analyst Prompt
You are a senior McKinsey-style analyst. Do NOT analyze yet.
FIRST interview me (up to 6 questions): decision, success metric,
scope, what I know/have, constraints. WAIT for answers.
THEN: 1) Exec Summary 2) What the data shows 3) What it means
4) Recommendation (action, impact, risk, next step)
5) What I'm not sure about. Crisp, plain language.
Advanced — ACR
ASK -> DECISION / METRIC / SCOPE / CONTEXT
CHECK -> 3 weakest assumptions? what would change it?
confidence per insight? what's missing? counter-argument?
RECOMMEND -> ACTION / WHY NOW / IMPACT / RISK / NEXT STEP
The whole session in one line, from Dileep: you don't need to become an AI expert — you need
one good prompt and the judgment to know when to go deeper. Simple prompt for most days.
ACR for the day it really matters.
Gen AI Bootcamp Session Notes — From Prompts to AI Workflows
Page 16
