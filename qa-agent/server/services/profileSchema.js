// The profile schema is the contract between the profiler, the prompt
// builder, and the suggestions service (ADR-005). Coarse enums by design:
// coarse profiles are stable, and they're all the prompt needs.

export const PROFESSIONS = [
  "engineering", "data_analytics", "hr", "marketing", "finance", "sales",
  "product", "founder", "student", "teacher", "doctor_healthcare",
  "hospitality", "manufacturing_operations", "customer_support", "recruiting",
  "design", "freelance_consulting", "other", "unknown",
];

export const OBJECTIONS = [
  "not_technical", "too_old", "no_time", "too_expensive", "ai_will_replace_me",
  "can_learn_free", "already_employed", "not_sure_worth_it",
  "need_to_ask_family", "next_batch", "trust_doubt", "other",
];

export const GOALS = [
  "side_income", "career_switch", "promotion_growth", "automate_work",
  "business_growth", "stay_relevant", "portfolio_job", "teach_others",
  "curiosity", "other",
];

export const PROFILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "profession", "professionConfidence", "experienceLevel", "aiFamiliarity",
    "careerStage", "market", "sentiment", "intent", "objections", "goals",
    "messageLanguage",
  ],
  properties: {
    profession: { type: "string", enum: PROFESSIONS },
    professionConfidence: { type: "number" },
    experienceLevel: {
      type: "string",
      enum: ["student", "early_career", "mid_career", "senior", "unknown"],
    },
    aiFamiliarity: {
      type: "string",
      enum: ["none", "basic", "intermediate", "advanced", "unknown"],
    },
    careerStage: {
      type: "string",
      enum: ["student", "employed", "leader", "founder", "freelancer", "career_break", "retired", "unknown"],
    },
    market: { type: "string", enum: ["india", "international", "unknown"] },
    sentiment: {
      type: "string",
      enum: ["excited", "curious", "confused", "skeptical", "anxious", "frustrated", "comparing", "neutral"],
    },
    intent: {
      type: "string",
      enum: [
        "concept_question", "program_question", "pricing_question",
        "career_question", "application_question", "objection",
        "logistics_question", "smalltalk", "feedback", "other",
      ],
    },
    objections: { type: "array", items: { type: "string", enum: OBJECTIONS } },
    goals: { type: "array", items: { type: "string", enum: GOALS } },
    messageLanguage: { type: "string" },
  },
};

export function emptyProfile() {
  return {
    profession: "unknown",
    professionConfidence: 0,
    experienceLevel: "unknown",
    aiFamiliarity: "unknown",
    careerStage: "unknown",
    market: "unknown",
    sentiment: "neutral",
    intent: "other",
    objections: [],
    goals: [],
    messageLanguage: "en",
  };
}

// Confidence-aware merge: accumulate what accumulates, never let one
// ambiguous message erase confidently-known facts (ADR-005).
export function mergeProfile(prev, obs) {
  if (!obs) return prev;
  const merged = { ...prev };

  if (
    obs.profession && obs.profession !== "unknown" &&
    (obs.professionConfidence ?? 0) >= Math.min(prev.professionConfidence || 0, 0.5)
  ) {
    if ((obs.professionConfidence ?? 0) >= (prev.professionConfidence || 0) || prev.profession === "unknown") {
      merged.profession = obs.profession;
      merged.professionConfidence = obs.professionConfidence ?? 0.5;
    }
  }
  for (const field of ["experienceLevel", "aiFamiliarity", "careerStage", "market"]) {
    if (obs[field] && obs[field] !== "unknown") merged[field] = obs[field];
  }
  if (obs.sentiment) merged.sentiment = obs.sentiment;
  if (obs.intent) merged.intent = obs.intent;
  if (obs.messageLanguage) merged.messageLanguage = obs.messageLanguage;
  merged.objections = [...new Set([...(prev.objections || []), ...(obs.objections || [])])];
  merged.goals = [...new Set([...(prev.goals || []), ...(obs.goals || [])])];
  return merged;
}
