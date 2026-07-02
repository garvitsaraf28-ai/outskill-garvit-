import test from "node:test";
import assert from "node:assert/strict";
import { emptyProfile, mergeProfile, PROFILE_JSON_SCHEMA } from "../server/services/profileSchema.js";

test("schema is structured-outputs compatible (objects closed, all required)", () => {
  assert.equal(PROFILE_JSON_SCHEMA.additionalProperties, false);
  assert.deepEqual(
    [...PROFILE_JSON_SCHEMA.required].sort(),
    Object.keys(PROFILE_JSON_SCHEMA.properties).sort()
  );
});

test("first confident observation sets profession", () => {
  const p = mergeProfile(emptyProfile(), {
    profession: "hr", professionConfidence: 0.95, market: "india",
    sentiment: "anxious", intent: "application_question",
    objections: ["not_technical"], goals: [],
  });
  assert.equal(p.profession, "hr");
  assert.equal(p.market, "india");
  assert.deepEqual(p.objections, ["not_technical"]);
});

test("low-confidence observation never downgrades a confident profession", () => {
  const known = mergeProfile(emptyProfile(), { profession: "finance", professionConfidence: 0.9, objections: [], goals: [] });
  const after = mergeProfile(known, { profession: "marketing", professionConfidence: 0.3, objections: [], goals: [] });
  assert.equal(after.profession, "finance");
  assert.equal(after.professionConfidence, 0.9);
});

test("unknown fields never erase known values", () => {
  const known = mergeProfile(emptyProfile(), {
    profession: "sales", professionConfidence: 0.8, market: "international",
    experienceLevel: "senior", objections: [], goals: [],
  });
  const after = mergeProfile(known, {
    profession: "unknown", professionConfidence: 0, market: "unknown",
    experienceLevel: "unknown", objections: [], goals: [],
  });
  assert.equal(after.profession, "sales");
  assert.equal(after.market, "international");
  assert.equal(after.experienceLevel, "senior");
});

test("objections and goals accumulate without duplicates", () => {
  let p = mergeProfile(emptyProfile(), { objections: ["no_time"], goals: ["side_income"] });
  p = mergeProfile(p, { objections: ["no_time", "too_expensive"], goals: ["side_income"] });
  assert.deepEqual(p.objections.sort(), ["no_time", "too_expensive"]);
  assert.deepEqual(p.goals, ["side_income"]);
});

test("null observation (profiler timeout) is a no-op", () => {
  const known = mergeProfile(emptyProfile(), { profession: "hr", professionConfidence: 0.9, objections: [], goals: [] });
  assert.deepEqual(mergeProfile(known, null), known);
});
