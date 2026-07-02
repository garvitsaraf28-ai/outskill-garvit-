// Profession-aware suggested questions. Deliberately static — instant, free,
// and curated (research §2.2: cold-start users don't know what to ask).

const GENERAL = [
  "What exactly is the AI Generalist Accelerator?",
  "How is this different from learning on YouTube?",
  "What does the program cost, and is EMI available?",
  "I have zero AI knowledge — where do I start?",
  "What will I be able to build after 14 days?",
  "Is there a certificate?",
];

const BY_PROFESSION = {
  hr: [
    "How can AI help me in HR and recruitment?",
    "Can AI screen resumes without bias?",
    "What HR tasks can I automate first?",
  ],
  marketing: [
    "How are marketers using AI for content and campaigns?",
    "Can AI really improve my SEO and ads?",
    "Which AI tools should a marketer learn first?",
  ],
  finance: [
    "How does AI help with forecasting and reporting?",
    "Can AI work with my Excel models?",
    "What finance tasks can I automate?",
  ],
  sales: [
    "How can AI help me close more deals?",
    "Can AI write my follow-ups and update my CRM?",
    "What's an AI agent for lead management?",
  ],
  engineering: [
    "Should I take the Generalist or Engineering Accelerator?",
    "What will I build in the Engineering Accelerator?",
    "Which agent frameworks does the program cover?",
  ],
  data_analytics: [
    "How does AI change the analyst role?",
    "Can AI write SQL and build reports for me?",
    "Generalist or Engineering track for an analyst?",
  ],
  product: [
    "How do PMs use AI day to day?",
    "Can AI help me mine user feedback?",
    "What should a PM build first with AI?",
  ],
  founder: [
    "How can AI grow my business without hiring?",
    "Can I automate my operations with AI?",
    "Should I learn AI myself or hire for it?",
  ],
  student: [
    "Will AI skills actually help me get placed?",
    "How do I build an AI portfolio as a student?",
    "Is the program worth it for a student budget?",
  ],
  teacher: [
    "How can teachers use AI for lesson planning?",
    "Can AI help me create quizzes and grade faster?",
    "Will AI replace teachers?",
  ],
  doctor_healthcare: [
    "How is AI useful in medicine and healthcare?",
    "What about patient-data privacy with AI?",
    "Can AI help with clinical documentation?",
  ],
  hospitality: [
    "How can AI improve guest experience?",
    "Can AI handle bookings and reviews for me?",
    "What should hospitality teams automate first?",
  ],
  manufacturing_operations: [
    "How does AI apply to operations and manufacturing?",
    "Can AI automate my reports and SOPs?",
    "Where do ops teams start with AI?",
  ],
  customer_support: [
    "Will AI replace support jobs?",
    "How do I move from doing support to running AI support?",
    "What support tasks can AI take over safely?",
  ],
  recruiting: [
    "How can AI speed up my sourcing and screening?",
    "Can AI personalize outreach at scale?",
    "What recruiting tasks should I automate first?",
  ],
  design: [
    "How are designers using AI without losing craft?",
    "Which AI tools fit a design workflow?",
    "Can AI help with client presentations?",
  ],
  freelance_consulting: [
    "How do I add an AI service line to my practice?",
    "Can AI help me deliver faster and raise rates?",
    "What reusable AI assets can I build?",
  ],
};

export function getSuggestions(profile) {
  const specific = BY_PROFESSION[profile?.profession] || [];
  const pool = [...specific, ...GENERAL.filter((q) => !specific.includes(q))];
  return pool.slice(0, 4);
}
