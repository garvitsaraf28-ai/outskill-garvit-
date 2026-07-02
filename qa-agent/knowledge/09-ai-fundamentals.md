# AI fundamentals — plain-language explanations

<!-- Teaching layer: the mentor uses these as ground truth for concept questions,
     always re-explained at the asker's level. -->

## What is generative AI?

Software that produces new content — text, images, audio, video, code — from instructions
you give in plain language. You describe what you want; the model generates it. That's the
whole interface revolution: the skill is describing well, not coding.

## What is an LLM (large language model)?

A model trained on enormous amounts of text to predict language. Practically: a very capable
text engine you can instruct — it can draft, summarize, translate, analyze, extract, and
reason over text you give it. ChatGPT, Claude, and Gemini are products built on LLMs.

## What is prompt engineering?

Writing instructions that reliably get the output you want: give the model a role, context,
the task, constraints, and an example of the desired format. It's a learnable craft —
Accelerator Day 1 — not a technical discipline. The biggest wins: be specific, show an
example, iterate.

## What is an AI agent?

An AI that doesn't just answer, but **acts**: it can use tools (search, spreadsheets, email,
APIs), take multiple steps, and work toward a goal — like an "AI employee". Example: an
agent that reads incoming leads, researches each one, drafts a reply, and files everything
in your CRM. Building your first one is Accelerator Day 4.

## What is AI automation / what is n8n?

Connecting AI into your existing workflows so repetitive work runs itself. n8n is a
visual workflow tool (drag-and-drop boxes): "when a form is submitted → summarize with AI →
add to sheet → notify me." No coding; Day 3 material. Compared with Zapier/Make/Power
Automate/UiPath, n8n is taught as the easiest, safest, most economical option.

## What is an MCP?

Model Context Protocol — a standard that lets an AI model connect to real tools and data
(your files, calendar, databases, apps) safely. It's how you turn a chat model into
something that can actually reach into your world. Covered on Accelerator Day 5, including
building your own MCP server (no-code path exists).

## What is RAG (retrieval-augmented generation)?

Giving the model your documents so it answers from *your* facts instead of its general
memory. The pattern behind every serious company chatbot — including this one, which answers
from Outskill's own program documents.

## Local models (Ollama, MSTY) — why run AI on your own machine?

Privacy (data never leaves your laptop), cost (free after download), and control. Tools like
Ollama and MSTY make this a download-and-click exercise now — it's a Day 1 hands-on in the
Accelerator.

## Voice, image and video AI

Modern tools can clone a voice (ElevenLabs), generate music (Suno), and create or edit
images and video from text. Real business uses: content production, personalized outreach,
training materials, multilingual dubbing. Day 2 material.

## Do I need math or coding to use AI?

No. Using AI well needs clear thinking and domain knowledge — knowing *what* to ask for and
*whether the output is good*. Your professional experience is the scarce ingredient; the
tools handle the rest. (Building AI *systems as an engineer* is a different path — that's
the Engineering Accelerator, and it does want Python.)

## Is AI a bubble / will this knowledge go stale?

Specific tools change monthly; the underlying skills — prompting, automation design, agent
thinking, judging output quality — transfer across tools. That's also why the Accelerator
includes weekly live update sessions for a year: the program's answer to "AI changes every
week" is to keep you current for a year, not to pretend one course is forever.
