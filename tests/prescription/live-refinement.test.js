import assert from "node:assert/strict";

import { buildMasterJson, POSTER_LIMITS } from "../../js/prescription/master-schema.js";
import { applyCopyRefinement, extractJsonObject } from "../../js/prescription/live-refinement.js";

const patient = {
  id: "case-en-1",
  name: "Alex Tan",
  diagnosis: "Post-op esophageal cancer recovery",
  stage: "Week 1"
};

const formInput = {
  language: "en-US",
  focusTopics: ["Diet", "Swallowing practice", "Red flags"],
  doctorNotes: "Keep the tone short and calm."
};

const draft = buildMasterJson({
  patient,
  formInput,
  evidence: []
});

const parsed = extractJsonObject(`
  Here is the JSON result:
  {
    "clinical_summary": "Focus on soft foods and warning signs first.",
    "must_know": ["Eat slowly", "Choose soft foods", "Watch red flags"]
  }
`);

assert.equal(parsed.clinical_summary, "Focus on soft foods and warning signs first.");
assert.deepEqual(parsed.must_know, ["Eat slowly", "Choose soft foods", "Watch red flags"]);

const refined = applyCopyRefinement(draft, {
  clinical_summary: "Focus on soft foods and warning signs first.",
  must_know: ["Eat slowly", "Choose soft foods", "Watch red flags"],
  must_do: ["Small meals", "Warm fluids", "Review daily"],
  must_avoid: ["Hard foods", "Large bites", "Ignoring pain"],
  red_flags: ["Vomiting", "Chest pain", "Cannot swallow"],
  copy_master: {
    one_sentence_takeaway: "Go slowly, choose soft foods, and escalate warning signs quickly.",
    short_summary: "Diet and red-flag education should come first in early recovery.",
    narration_script: "You are in early recovery. Use soft foods, eat slowly, and call your team if warning signs appear.",
    doctor_review_note: "Pending clinician review before patient release."
  },
  poster_spec: {
    title: "Very long poster title that should be clamped by the merge helper",
    subtitle: "A detailed subtitle that should also be clamped to the poster limit",
    key_points: ["Eat slowly", "Soft foods", "Red flags first"],
    do_list: ["Small meals", "Warm fluids", "Review plan"],
    dont_list: ["Hard foods", "Fast eating", "Ignore pain"],
    red_flags: ["Vomiting", "Chest pain", "Cannot swallow"],
    footer_badge: "Doctor reviewed",
    source_tag: "Evidence bundle"
  }
});

assert.equal(refined.spec.clinical_core.clinical_summary, "Focus on soft foods and warning signs first.");
assert.deepEqual(refined.spec.clinical_core.must_do, ["Small meals", "Warm fluids", "Review daily"]);
assert.deepEqual(refined.spec.clinical_core.red_flags, ["Vomiting", "Chest pain", "Cannot swallow"]);
assert.equal(refined.spec.copy_master.doctor_review_note, "Pending clinician review before patient release.");
assert.ok(refined.spec.poster_spec.title.length <= POSTER_LIMITS.title);
assert.ok(refined.spec.poster_spec.subtitle.length <= POSTER_LIMITS.subtitle);
assert.equal(refined.spec.poster_spec.key_points[0], "Eat slowly");
assert.equal(refined.spec.poster_spec.key_points[1], "Soft foods");
assert.ok(refined.spec.poster_spec.key_points[2].startsWith("Red flags"));
refined.spec.poster_spec.key_points.forEach((item) => {
  assert.ok(item.length <= POSTER_LIMITS.keyPoint);
});

console.log("live-refinement.test.js passed");
