// Profession-aware suggested questions. Deliberately static — instant, free,
// and curated (research §2.2: cold-start users don't know what to ask).
// Keys follow the official domain taxonomy in profileSchema.js; domains
// without a curated set fall back to the general list.

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
  investment_banking: [
    "How is AI used in deal research and financial modeling?",
    "Can AI draft pitch books and summaries?",
    "What should a banker automate first?",
  ],
  accounting: [
    "Can AI handle reconciliations and reporting?",
    "How do accountants use AI without risking accuracy?",
    "What accounting tasks can I automate first?",
  ],
  chartered_accountant: [
    "How can a CA use AI in audit and compliance work?",
    "Can AI help with tax research and client reporting?",
    "What should a CA practice automate first?",
  ],
  sales: [
    "How can AI help me close more deals?",
    "Can AI write my follow-ups and update my CRM?",
    "What's an AI agent for lead management?",
  ],
  software_engineering: [
    "Should I take the Generalist or Engineering Accelerator?",
    "What will I build in the Engineering Accelerator?",
    "Which agent frameworks does the program cover?",
  ],
  data_science: [
    "How does GenAI change the data science role?",
    "Generalist or Engineering track for a data scientist?",
    "What agentic systems would I build in the program?",
  ],
  data_analytics: [
    "How does AI change the analyst role?",
    "Can AI write SQL and build reports for me?",
    "Generalist or Engineering track for an analyst?",
  ],
  product_management: [
    "How do PMs use AI day to day?",
    "Can AI help me mine user feedback?",
    "What should a PM build first with AI?",
  ],
  startup_founder: [
    "How can AI grow my business without hiring?",
    "Can I automate my operations with AI?",
    "Should I learn AI myself or hire for it?",
  ],
  business_owner: [
    "How can AI grow my business without hiring?",
    "What business processes should I automate first?",
    "Can AI become a new service line for my company?",
  ],
  student: [
    "Will AI skills actually help me get placed?",
    "How do I build an AI portfolio as a student?",
    "Is the program worth it for a student budget?",
  ],
  education: [
    "How can teachers use AI for lesson planning?",
    "Can AI help me create quizzes and grade faster?",
    "Will AI replace teachers?",
  ],
  research: [
    "How can AI speed up literature review and analysis?",
    "Can AI help me draft papers responsibly?",
    "What research tasks can I automate?",
  ],
  healthcare: [
    "How is AI useful in healthcare work?",
    "What about patient-data privacy with AI?",
    "Can AI help with clinical documentation?",
  ],
  medicine: [
    "How is AI useful in medical practice?",
    "What about accuracy and patient-data privacy?",
    "Can AI help with clinical notes and case prep?",
  ],
  hospitality: [
    "How can AI improve guest experience?",
    "Can AI handle bookings and reviews for me?",
    "What should hospitality teams automate first?",
  ],
  operations: [
    "How does AI apply to operations work?",
    "Can AI automate my reports and SOPs?",
    "Where do ops teams start with AI?",
  ],
  supply_chain: [
    "How is AI used in supply chain and logistics?",
    "Can AI improve demand forecasting?",
    "What supply-chain tasks can I automate?",
  ],
  manufacturing: [
    "How does AI apply to manufacturing?",
    "Can AI automate quality reports and SOPs?",
    "Where do plants start with AI?",
  ],
  civil_engineering: [
    "How can a civil engineer use AI day to day?",
    "Can AI help with reports, BOQs and site documentation?",
    "Do I need coding to use AI in engineering work?",
  ],
  mechanical_engineering: [
    "How can a mechanical engineer use AI?",
    "Can AI help with documentation and calculations?",
    "Do I need coding for the program?",
  ],
  electrical_engineering: [
    "How can an electrical engineer use AI?",
    "Can AI help with reports and design documentation?",
    "Generalist or Engineering track for me?",
  ],
  electronics_engineering: [
    "How can an electronics engineer use AI?",
    "Can AI help with datasheets and documentation?",
    "Generalist or Engineering track for me?",
  ],
  architecture: [
    "How are architects using AI today?",
    "Can AI help with concept boards and client decks?",
    "What should an architect automate first?",
  ],
  real_estate: [
    "How can AI help in real estate sales and marketing?",
    "Can AI automate listings and client follow-ups?",
    "What should a realtor automate first?",
  ],
  construction: [
    "How does AI apply to construction projects?",
    "Can AI help with site reports and schedules?",
    "What should a construction team automate first?",
  ],
  law: [
    "How can lawyers use AI safely?",
    "Can AI help with legal research and drafting?",
    "What about confidentiality when using AI?",
  ],
  consultant: [
    "How do I add an AI service line to my practice?",
    "Can AI help me deliver faster and raise rates?",
    "What reusable AI assets can I build?",
  ],
  freelancer: [
    "How do I add an AI service line to my practice?",
    "Can AI help me deliver faster and raise rates?",
    "How do I find AI freelance clients?",
  ],
  government_public_sector: [
    "How is AI used in government and public-sector work?",
    "Can AI help with reports and citizen communication?",
    "What should I automate first in my department?",
  ],
  career_transition: [
    "How do I transition my career using AI skills?",
    "Which AI roles fit someone changing fields?",
    "How fast can a beginner become useful with AI?",
  ],
};

export function getSuggestions(profile) {
  const specific = BY_PROFESSION[profile?.profession] || [];
  const pool = [...specific, ...GENERAL.filter((q) => !specific.includes(q))];
  return pool.slice(0, 4);
}
