# Bootcamp Session — Building Projects and AI Assistants

G E N A I B O OTC A M P — S U M M A RY D O C U M E N T
Building Projects
& AI Assistants
Turn one good prompt into a reusable assistant — built on Claude
Projects.
What's inside
▪ The XML prompting structure — the reusable skeleton behind every reliable AI
assistant
▪ How to build a Claude Project — from prompt to published assistant, step by step
▪ Ready-to-use prompt examples — a LinkedIn writer in Outskill's voice, and an
email bot
▪ The 5-level path — how building assistants fits into becoming an AI Generalist

### T H E FO U N DAT I O N
### It Starts With a Problem, Not a Tool
A Claude Project is a saved, specialised assistant — a system prompt and knowledge files bundled
so the same expert is ready every time you open it. It is only worth building if it removes a real,
repetitive task. The best assistants are born from something you already do over and over and wish
you could hand off.
This document uses one concrete example throughout: an assistant that writes excellent emails.
The same structure and the same steps build a customer-support bot, a sales bot, a copywriting
bot, or a research bot. The idea changes; the method stays identical.
### The one idea behind everything here
An assistant is only as good as its instructions. The entire skill is writing structured
instructions — and the reliable way to do that is to have Claude write them for you, in a fixed
XML structure, then paste them into the Project builder. You are not learning a tool. You're
learning a structure.
PA R T 1 · T H E C O R E S K I L L
### The XML Prompting Structure
Every reliable Claude Project is built on the same skeleton. XML tags give the model a clear,
machine-readable hierarchy — it knows who it is, what it must achieve, what to assume, exactly what
to do, and what never to do. Loose paragraphs drift; structured XML holds.
### What is XML Prompting, in plain English?
### The simple version
XML prompting is a way of writing AI instructions using named labels called tags — the same
kind of brackets you see in web code. Instead of one long paragraph the AI has to interpret,
you wrap each part of your instruction in a clearly named tag.
<role> tells the AI who it is. <task> tells it exactly what to do. <constraints> tell it what to
avoid. The model reads the result like a structured form — each section is unambiguous,
ordered, and predictable. Better structure means more consistent outputs, every single time.
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 2

The advanced XML prompting structure — every part of the prompt lives in a dedicated tag.
### The Structure, Tag by Tag
Tag 	What goes in it
<role> 	Who the bot is — its identity, expertise, and voice
<context> 	Background it should always assume: who built it, the audience it serves,
and what tone to use
<task> 	The specific job — the raw material it receives (<input>) and what it must
produce (<goal>)
<instructions> 	Concrete, ordered steps the bot follows to complete the task
<constraints> 	Guardrails — what it must never do (<do_not>) and its non-negotiable rules
(<must_do>)
<output_format> 	Exactly how the final answer should look — length, structure, and labels
### The Blank Template
This is the skeleton to memorise. Every assistant you build fills in these same tags.
<prompt>
<role>Who AI should become</role>
<context>
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 3

<creator>Who this is for</creator>
<audience>Who will read it</audience>
<writing_style>How it should sound</writing_style>
</context>
<task>
<input>The raw material</input>
<goal>The actual job</goal>
</task>
<instructions>How to do the job</instructions>
<constraints>
<do_not>Things to avoid</do_not>
<must_do>Non-negotiable rules</must_do>
</constraints>
<output_format>How the final answer should look</output_format>
</prompt>
Example — A LinkedIn Writer in Outskill's Voice
Here is what a production-ready XML prompt looks like: specific, opinionated, and written for a real
brand voice. This is the quality bar to aim for — notice how the <writing_style> and <constraints>
tags do the heavy lifting that turns a generic post into one that sounds like Outskill.
<prompt>
<role>
You are a LinkedIn content strategist and ghostwriter for Outskill,
India's leading AI upskilling platform. You write punchy, insight-driven
posts that sound like a sharp practitioner — not a marketing department.
</role>
<context>
<creator>
Outskill — founded by Vaibhav Sisinty, teaching working professionals
to become AI-fluent and future-proof their careers.
</creator>
<audience>
Working professionals, students, and founders who want to learn AI.
Ambitious, action-oriented, skeptical of hype.
</audience>
<writing_style>
Direct and conversational. Short sentences. No fluff. Opens with a
hook — a stat, a bold claim, or an uncomfortable truth. Generous line
breaks for mobile. Ends with a CTA or a question that drives comments.
Never sounds corporate. Sounds like someone who builds things.
</writing_style>
</context>
<task>
<input>
The raw idea, topic, stat, or bullet points the user provides.
</input>
<goal>
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 4

A scroll-stopping LinkedIn post that builds authority for Outskill
and drives saves, comments, or follows.
</goal>
</task>
<instructions>
Turn the raw input into a complete, ready-to-publish LinkedIn post using
the writing style above. Prioritise the hook — if the first line won't
make someone stop scrolling, rewrite it before proceeding.
</instructions>
<constraints>
<do_not>
Never open with "Excited to share..." or "Proud to announce..." Never
use corporate buzzwords. No em-dashes or semicolons. Avoid bullet lists
unless the post is explicitly a list-style format.
</do_not>
<must_do>
Hook in the first line. Max 1–2 lines per paragraph. Line breaks
between every thought. End with a CTA ("DM me 'AI' to get started")
or a question that invites comments.
</must_do>
</constraints>
<output_format>
A complete LinkedIn post (150–300 words), then 3 alternative hook
options labelled Hook A, Hook B, and Hook C.
</output_format>
</prompt>
Example — The Email-Writing Assistant
The same structure applied to the email assistant used as the running example throughout this
document.
<prompt>
<role>
You are an expert executive communications writer. You write clear,
warm, and persuasive emails in the user's own voice.
</role>
<context>
<creator>
A busy professional who often gives only a few words about what
they need sent.
</creator>
<audience>
Work email recipients — colleagues, clients, and senior stakeholders.
</audience>
<writing_style>
Professional but human. Concise. Plain, confident language. No
corporate jargon or filler. Default to brief.
</writing_style>
</context>
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 5

<task>
<input>
The user's rough intent — a few words, bullet points, or a messy draft.
</input>
<goal>
A send-ready email that gets a reply and protects the relationship.
</goal>
</task>
<instructions>
If the request is unclear, ask up to 3 quick questions first (recipient,
goal, desired tone). Otherwise proceed. Draft the email with: a specific
subject line, a one-line opener, the core message in 2–4 short paragraphs,
and one clear call to action. After the draft, offer 2 alternative versions
in different tones (e.g. "Warmer" / "More direct").
</instructions>
<constraints>
<do_not>
Never invent facts, names, numbers, or commitments. No corporate jargon
or filler phrases.
</do_not>
<must_do>
Match the user's language. Mirror any sample they paste. Keep most
emails under 150 words unless explicitly asked otherwise.
</must_do>
</constraints>
<output_format>
Subject line, then the full email draft, then 2 alternative tone options
labelled clearly.
</output_format>
</prompt>
PA R T 2 · T H E W O R K F LO W
### Let Claude Write the Prompt First
The reliable move is not to write the XML prompt by hand. Instead, explain your use case to Claude
in a normal chat, hand it the structure, and ask for the whole thing in one clean block to copy. Claude
fills every tag with specific, opinionated language faster and more consistently than writing from
scratch.
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 6

### The prompt to use
I want to build a Claude Project that writes excellent emails for me. (Replace this line with your
own use case.)
Write the system prompt using EXACTLY this XML structure: <prompt> with <role>, <context>
(containing <creator>, <audience>, <writing_style>), <task> (containing <input>, <goal>),
<instructions>, <constraints> (containing <do_not>, <must_do>), and <output_format>.
Make it specific, production-ready, and opinionated. Fill every section. Output the entire prompt
inside ONE code block so I can copy it cleanly.
### Why this order matters
Building the Project before the prompt is decorating a room before deciding what it's for. The
prompt is the brief; the builder is just where you hang it.
### What a Strong Prompt Looks Like
Before building, the generated prompt is worth a quick read. A weak prompt makes a weak
assistant. If any tag is vague, the fix is one line back to Claude — "Make <instructions> and
<constraints> more specific" — and a regenerate. A strong prompt clears this bar:
PA R T 3 · B U I L D I N G I T
### Building a Claude Project
Claude Projects save a system prompt and knowledge files so the same specialised assistant is
available every time you open it — one prompt, persistent context, no copy-pasting instructions into
every new chat. The build is six short steps.
<role> names a clear identity, expertise, and a voice	✔
<goal> is one concrete outcome, not a list of vague hopes	✔
<instructions> are concrete steps you could follow yourself	✔
<do_not> contains real guardrails ("Never…"), not filler	✔
<output_format> describes the exact shape of the answer	✔
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 7

1. Open Claude and go to Projects
Sign in at claude.ai, find Projects in the left sidebar, and click + New Project.
2. Name it
Give it a name you'll recognise in the sidebar — for instance "Email Writer" or "LinkedIn Bot."
3. Add the custom instructions
Paste your full XML prompt into the Custom Instructions field. This is the brain of the Project —
everything the assistant knows about its role, task, and rules.
4. Upload knowledge (optional)
If you have reference material — sample emails, a brand style guide, FAQs — upload it under
Knowledge. The assistant draws on these files in every conversation, so its outputs match your real
voice and facts.
5. Test and iterate
Start a conversation inside the Project and give it real tasks, not toy ones. When something is off, fix
the matching XML tag rather than rewriting at random.
6. Use and share
Keep the Project private, or share the link so teammates open it with the same instructions baked in.
It lives in the sidebar, ready for every new conversation.
A small touch that pays off — conversation starters
Adding 2–4 example opening prompts means anyone using the Project knows exactly how to
begin — for example, "Write a follow-up email to a prospect who went quiet," or "Turn these
bullet points into a post about AI trends."
PA R T 4 · R E F I N E M E N T
### Tuning It Like a Pro
The first version is never the final one. Good assistants are tuned, not authored. The discipline is to
test with realistic inputs and change the prompt surgically — one tag at a time.
Test with three inputs of different difficulty — an easy one, a vague one, and an edge case.
Judge three things each time: format (did it follow the structure?), tone (does it sound right?),
and safety (did it invent anything?).
•
•
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 8

When it fails, trace the failure to a single tag and edit only that — usually <instructions> for
behaviour or <do_not> for a guardrail.
### The key diagnostic
If you can't name the XML tag that caused a failure, the prompt isn't structured enough yet.
Structured prompts produce diagnosable failures — and diagnosable failures are fixable.
PA R T 5 · R E U S E
### One Template, Many Assistants
The structure is a reusable asset. To build any other assistant, keep the XML skeleton and swap the
top three tags — <role>, <goal>, and <context>. The instructions and constraints adapt naturally
from there.
Assistant you
want <role> becomes 	<goal> becomes
Support bot 	A calm, accurate support
specialist
Resolve the issue or escalate
cleanly
Sales bot 	A consultative sales rep 	Qualify and move the deal forward
Copywriting bot 	A punchy brand copywriter 	On-brand copy that converts
Research bot 	A rigorous research analyst 	A sourced, structured briefing
LinkedIn bot 	A sharp content strategist 	A scroll-stopping post in your voice
PA R T 6 · T H E B I G G E R P I C T U R E
5 Levels to Become an AI Generalist
Building a Claude Project is one milestone on a five-level journey. Here is the full map — where this
skill fits, what comes next, and what you'll be capable of once all five levels are complete.
•
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 9

The five-level path from AI user to AI Generalist.
### Level 1
### Master the Machine
You stop using AI casually and start using it with precision. You master advanced
prompting techniques that produce consistently great outputs, experiment
across multiple AI models to learn their distinct strengths, run open-source LLMs
locally on your own hardware, and use the OpenAI Playground to fine-tune
parameters and see how they change a model's behaviour. By the end, prompting
is a repeatable skill you direct rather than guesswork.
### Level 2
### Connect & Automate
You move from talking to AI inside chat boxes to wiring it into real systems. MCP
(Model Context Protocol) lets your assistant connect to external tools —
calendars, documents, databases, APIs — both online and offline. You design the
system prompts that give an AI a persistent identity and purpose, then build fully
autonomous voice agents that take action without you watching over them.
### Level 3
### Create with AI
The creative layer unlocks. You learn how diffusion models generate images and
video, build your own AI clone that speaks and presents in your voice, and
produce branded visual content — ads, branding material, and even short films —
that once required a full production team and a real budget. Level 3 turns you
into a one-person creative studio operating at professional scale.
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 10

### Level 4
### Build Workflows & Agents
You stop doing repetitive work yourself and build systems that do it for you.
Complex agentic workflows chain AI decisions together — the assistant doesn't
just respond, it plans, loops, and acts across multiple steps. You get hands-on
with AI Agents that browse the web, write and run code, and optimise entire
business processes end-to-end with minimal supervision.
### Level 5
### Ship Real Products
The final level is execution. You take every skill built so far — prompting,
automation, creative AI, agentic workflows — and assemble a real-world AI
product using no-code builders, with no engineering background required. You
cross the line from AI practitioner to AI builder: someone who doesn't just use
the tools but creates things other people use every day.
The Destination: The AI Generalist
Complete all five levels and you become something genuinely rare in any organisation — an AI
Generalist, the most valuable person in any room in 2026.
T-shaped: broadly capable across every AI domain, deeply expert in one of them.
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 11

What "T-shaped" means
T-shaped means broad capability across all layers of AI — prompting, automation, creative
tools, agentic workflows, and product building — paired with deep expertise in one of them
that matches your career path.
A marketer who goes deep on Level 3 becomes unstoppable at brand content. An ops person
who masters Level 4 redesigns entire processes. A product manager who combines Level 1
and Level 5 ships AI products without waiting for a dev team. The horizontal bar of the T
protects you from being replaced; the vertical bar makes you irreplaceable.
### What an AI Generalist does
Solves real problems with AI — not just
demo prompts
Ships work across Marketing, Sales, Ops,
### Product, and Finance using GenAI
Becomes the go-to person on AI in any
team
Uses AI like a thought partner with years
of experience baked in
### Why this matters for you
Future-proof your career as your
organisation adopts AI
Open passive income streams through
consulting and your own products
Land AI Generalist roles at 1.5x–3x your
current pay
### Quick Reference
THE XML PROMPTING STRUCTURE
<prompt>
<role> → who the bot is + its voice
<context>
<creator> → who built this / who it serves
<audience> → who reads the output
<writing_style> → how it should sound
</context>
<task>
<input> → raw material the user provides
<goal> → the one outcome, every time
</task>
<instructions> → concrete, ordered steps
<constraints>
<do_not> → what it must NEVER do
<must_do> → non-negotiable rules
</constraints>
<output_format> → exact shape of the answer
</prompt>
•
•
•
•
•
•
•
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 12

### The Essentials, Recapped
### The whole idea in one line
A great Claude Project is a great XML prompt with a saved home. Get the prompt right —
structured, specific, guarded — and the platform barely matters.
Start from a real, repetitive problem — never build an assistant for its own sake	✔
The whole skill is the XML structure: role, context, task, instructions, constraints, output_format	✔
Let Claude write the prompt for you, filling every tag inside one clean code block	✔
Build the Claude Project: name it, paste the instructions, upload knowledge, then test and share	✔
Tune by tag — trace each failure to one XML tag and edit only that	✔
Reuse the same skeleton for every future assistant by swapping role, goal, and context	✔
Gen AI Bootcamp 	Building Projects & AI Assistants
Page 13
