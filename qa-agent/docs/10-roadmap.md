# Roadmap

## Now (shipped in v1)

Streaming personalized QA · joint structured profiler · BM25 RAG over curated corpus ·
three-layer memory with async compaction · compliance rails + golden-set eval · premium
no-build UI · feedback capture · full docs.

## Next (highest value / lowest risk)

1. **Live "session context" channel** — a tiny ops box where the event host types "we're on
   Day-3 n8n demo now"; injected as a volatile block so answers reference what's happening
   on screen right now.
2. **Ops dashboard** — feedback triage UI, top unanswered/negative questions per event,
   token spend, profile distribution of the audience (gold for the sales team).
3. **Hindi / Hinglish first-class support** — the profiler already detects language; add
   golden cases and tune the mentor's register.
4. **LLM-graded eval layer** — personalization and tone rubrics on top of the regex checks.
5. **Store swap to Postgres** — unlocks horizontal scaling (interfaces already cut).

## Later

- **Hybrid retrieval** (ADR-003 upgrade path) when the corpus outgrows lexical quality.
- **Escalation handoff integration** — "connect me to the team" creates a ticket/WhatsApp
  handoff with conversation summary attached (the summary already exists per session).
- **Server-side compaction** (API beta → GA) to replace the custom summarizer (ADR-004).
- **Batch nightly analysis** — cluster the week's questions (Batches API, 50% cost) to feed
  curriculum and marketing: what does the audience actually not understand?
- **Voice mode** — reuse the org's existing TTS/STT experience from the sales-training app.
- **A/B prompt experiments** — config-driven system-prompt variants with feedback-rate
  comparison.
