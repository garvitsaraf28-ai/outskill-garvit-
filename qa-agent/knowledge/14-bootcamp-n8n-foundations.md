# Bootcamp Session — Getting Started with n8n (workflow automation)

Getting Started
with n8n
Session notes — your quick-reference guide to understanding and
building automations with n8n.
▪ Format — Session Notes / Guide
▪ Level — Beginner-Friendly
▪ Reading time — 10–15 minutes

## THEBASICS
What is n8n?
n8n (pronounced "nodemation") is a free, open-source workflow automation platform. Think of it as
a visual programming tool where you connect different apps and services together — without writing
code.
If you've heard of Zapier or Make (formerly Integromat), n8n does the same thing — but gives you
far more control, and you can self-host it for free.
### Why n8n?
Key Concepts — The Building Blocks
Before you touch the n8n canvas, get comfortable with these five terms. Everything in n8n is built
from them.
### Workflow
A complete automation — the full chain of steps that runs when triggered. Each workflow lives as its
own project in n8n.
### Node
A single step in your workflow. Each node does one thing: read an email, call an API, transform data,
send a message, and so on.
### Trigger
A special node that starts a workflow. It listens for an event — a new email, a scheduled time, a
webhook call — and kicks everything off.
### Connection
The line that links one node to the next. Data flows along connections from left to right, output →
input.
### Expression
A dynamic value written as {{ $json.fieldName }} . Expressions let you reference data from
previous nodes instead of typing static text.
Visual & no-code — drag, drop, and connect nodes on a canvas.	✔
400+ integrations — Gmail, Slack, Notion, Sheets, OpenAI, databases, and more.	✔
AI-native — built-in nodes for LLMs, AI Agents, vector stores, and RAG workflows.	✔
Free tier — generous cloud plan; or self-host with zero cost.	✔
Community — active forums, templates, and thousands of shared workflows.	✔
Gen AI Bootcamp 	Getting Started with n8n
Page 2

## AQUICKTOUR
### The n8n Interface
When you open n8n, you'll see a clean canvas with a toolbar. Here's what each area does:
### Canvas
The large central area where you place and connect nodes. Drag to pan, scroll to zoom.
Node Panel (+)
Click the + button or press Tab to search and add nodes. You can search by app name ("Gmail") or
by action ("Send message").
### Executions
The log of every time your workflow has run. Click any execution to see what data flowed through
each node — invaluable for debugging.
### Workflow Toggle
The Inactive / Active switch at the top right. Flip it to Active to make your workflow run automatically.
### Credentials
Stored under Settings → Credentials. This is where your API keys and OAuth connections live (Gmail,
OpenAI, Slack, etc.).
Pro Tip — Keyboard Shortcuts
Tab — open node search
Ctrl/Cmd + S — save
Ctrl/Cmd + Enter — execute workflow
D — disable / enable node
Backspace — delete selected node
03 H A N D S - O N
### Your First Workflow in 5 Minutes
Let's build something real — a simple workflow that triggers on a schedule and sends you a Slack
message (or email) every morning. This teaches the core mechanics.
Gen AI Bootcamp 	Getting Started with n8n
Page 3

### Step by Step
### What Just Happened?
You built a three-node workflow: Schedule Trigger → Set (data) → Gmail (action). Every n8n
automation follows this same pattern — a trigger, optional data transformation, and one or
more action nodes. The complexity grows, but the pattern stays the same.
04 A I- N AT I V E
Adding AI to Your Workflows
n8n has first-class support for AI. You can plug in OpenAI, Google Gemini, Anthropic Claude, or local
models — and use them as thinking engines inside any workflow.
Create a new workflow. Click "+ Add Workflow" from the dashboard. Name it "My First
Automation".
1
Add a Schedule Trigger. Press Tab , search for "Schedule Trigger", and add it. Set it to run
every day at 9:00 AM.
2
Add a Set node. Press Tab → search "Set" → add it. This lets you define the message
content. Add a field: Name = message , Value = "Good morning! Time to check your tasks."
3
Connect the nodes. Drag from the Schedule Trigger's output (right dot) to the Set node's
input (left dot). You'll see a line connecting them.
4
Add a Gmail node. Press Tab → search "Gmail" → add it. Set Resource to Message,
Operation to Send. Connect your Gmail credential. In the To field, enter your own email. In the
Message field, type: {{ $json.message }}
5
Test it! Click "Test Workflow" (top right). Check your inbox — you should have the morning
message. If it works, toggle the workflow to Active.
6
Gen AI Bootcamp 	Getting Started with n8n
Page 4

### The AI Nodes You'll Use Most
Node 	When to use
AI Agent 	Best all-rounder. Understands context, can use tools, and chains
reasoning steps.
OpenAI Chat Model 	Direct access to GPT models. Use as a sub-node inside AI Agent.
Basic LLM Chain 	Simple prompt → response. Great when you don't need agent reasoning.
Text Classifier 	Categorise text into labels (e.g. "urgent" vs "low priority").
Sentiment Analysis 	Detect whether text is positive, negative, or neutral.
Summarisation Chain 	Condense long text into short summaries.
Connecting Your OpenAI Key
5 Workflow Ideas to Try Next
In any AI node, click "Create New Credential".	1
Paste your OpenAI API key (from platform.openai.com → API Keys).	2
Choose your model — gpt-4o-mini is recommended for speed and cost.	3
Click Save. The credential is reusable across all your workflows.	4
AI Email Replier — auto-draft replies to incoming emails using AI. (See our dedicated workbook!)	▸
Slack Summariser — summarise daily Slack messages and post a digest each evening.	▸
Lead Qualifier — when a form is submitted, use AI to score and categorise the lead.	▸
Content Repurposer — feed a blog post URL → AI generates a LinkedIn post + tweet + email.	▸
Meeting Notes Bot — record a meeting transcript → AI extracts action items → creates tasks in
Asana.
▸
Gen AI Bootcamp 	Getting Started with n8n
Page 5

## CHE AT SHEET
Quick Reference & Resources
n8n Terminology Cheat Sheet
Term 	Meaning
Workflow 	Your complete automation (collection of connected nodes)
Node 	A single step / action in the workflow
Trigger Node 	The starting node — listens for an event to begin the workflow
Action Node 	A node that does something (send email, create record, call API)
Expression {{ }} 	Dynamic values that reference data from previous nodes
Credential 	Stored API key or OAuth token for connecting external services
Execution 	A single run of your workflow (logged with full data)
Webhook 	A URL that triggers your workflow when called by another app
Sub-workflow 	A workflow called from within another workflow (for modularity)
### Helpful Links
Resource 	Link
n8n Cloud (sign up) 	app.n8n.cloud/register
n8n Documentation 	docs.n8n.io
Workflow Templates 	n8n.io/workflows
Community Forum 	community.n8n.io
OpenAI API Keys 	platform.openai.com/api-keys
n8n YouTube Channel 	youtube.com/@n8n-io
Gen AI Bootcamp 	Getting Started with n8n
Page 6

You're ready to automate.
Start small, build one workflow, and expand from there.
Every automation you create saves future-you hours of manual work.
G E N A I B O O T C A M P • B U I L D. A U T O M AT E . G R O W.
Gen AI Bootcamp 	Getting Started with n8n
Page 7
