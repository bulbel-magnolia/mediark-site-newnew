import { POSTER_LIMITS, clampPosterText } from "./master-schema.js";

function normalizeArray(value, limit) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => limit ? clampPosterText(item, limit) : item.trim());
}

function findJsonSlice(text) {
  const source = String(text || "");
  const start = source.indexOf("{");

  if (start === -1) {
    throw new Error("No JSON object found in model response.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error("Incomplete JSON object found in model response.");
}

export function extractJsonObject(text) {
  if (text && typeof text === "object" && !Array.isArray(text)) {
    return text;
  }

  const source = String(text || "").trim();

  if (!source) {
    throw new Error("Empty model response.");
  }

  try {
    return JSON.parse(source);
  } catch {
    return JSON.parse(findJsonSlice(source));
  }
}

export function buildTextRefinementPrompt({ patient, formInput, evidence, draftMasterJson }) {
  return [
    "You are a clinician-in-the-loop patient education copy assistant.",
    "Return one JSON object only. No markdown fences.",
    "Keep the writing clinically conservative, easy to understand, and suitable for patient education.",
    "Do not add treatment recommendations beyond the provided context.",
    "",
    "Patient:",
    JSON.stringify({
      id: patient?.id || "",
      name: patient?.name || "",
      diagnosis: patient?.diagnosis || "",
      stage: patient?.stage || ""
    }, null, 2),
    "",
    "Form input:",
    JSON.stringify(formInput || {}, null, 2),
    "",
    "Evidence bundle:",
    JSON.stringify(evidence || [], null, 2),
    "",
    "Draft master JSON:",
    JSON.stringify(draftMasterJson || {}, null, 2),
    "",
    "Return this shape:",
    JSON.stringify({
      clinical_summary: "",
      must_know: ["", "", ""],
      must_do: ["", "", ""],
      must_avoid: ["", "", ""],
      red_flags: ["", "", ""],
      copy_master: {
        one_sentence_takeaway: "",
        short_summary: "",
        narration_script: "",
        doctor_review_note: ""
      },
      poster_spec: {
        title: "",
        subtitle: "",
        key_points: ["", "", ""],
        do_list: ["", "", ""],
        dont_list: ["", "", ""],
        red_flags: ["", "", ""],
        footer_badge: "",
        source_tag: ""
      }
    }, null, 2)
  ].join("\n");
}

export function applyCopyRefinement(masterJson, refinement = {}) {
  const next = structuredClone(masterJson);
  const clinicalCore = next?.spec?.clinical_core;
  const copyMaster = next?.spec?.copy_master;
  const posterSpec = next?.spec?.poster_spec;

  if (!clinicalCore || !copyMaster || !posterSpec) {
    return next;
  }

  if (typeof refinement.clinical_summary === "string" && refinement.clinical_summary.trim()) {
    clinicalCore.clinical_summary = refinement.clinical_summary.trim();
  }

  const mustKnow = normalizeArray(refinement.must_know);
  const mustDo = normalizeArray(refinement.must_do);
  const mustAvoid = normalizeArray(refinement.must_avoid);
  const redFlags = normalizeArray(refinement.red_flags);

  if (mustKnow.length) {
    clinicalCore.must_know = mustKnow;
  }

  if (mustDo.length) {
    clinicalCore.must_do = mustDo;
  }

  if (mustAvoid.length) {
    clinicalCore.must_avoid = mustAvoid;
  }

  if (redFlags.length) {
    clinicalCore.red_flags = redFlags;
  }

  const copyOverride = refinement.copy_master || {};

  [
    "one_sentence_takeaway",
    "short_summary",
    "narration_script",
    "doctor_review_note"
  ].forEach((field) => {
    if (typeof copyOverride[field] === "string" && copyOverride[field].trim()) {
      copyMaster[field] = copyOverride[field].trim();
    }
  });

  const posterOverride = refinement.poster_spec || {};

  if (typeof posterOverride.title === "string" && posterOverride.title.trim()) {
    posterSpec.title = clampPosterText(posterOverride.title, POSTER_LIMITS.title);
  }

  if (typeof posterOverride.subtitle === "string" && posterOverride.subtitle.trim()) {
    posterSpec.subtitle = clampPosterText(posterOverride.subtitle, POSTER_LIMITS.subtitle);
  }

  const keyPoints = normalizeArray(posterOverride.key_points, POSTER_LIMITS.keyPoint);
  const doList = normalizeArray(posterOverride.do_list, POSTER_LIMITS.action);
  const dontList = normalizeArray(posterOverride.dont_list, POSTER_LIMITS.action);
  const posterRedFlags = normalizeArray(posterOverride.red_flags, POSTER_LIMITS.redFlag);

  if (keyPoints.length) {
    posterSpec.key_points = keyPoints;
  }

  if (doList.length) {
    posterSpec.do_list = doList;
  }

  if (dontList.length) {
    posterSpec.dont_list = dontList;
  }

  if (posterRedFlags.length) {
    posterSpec.red_flags = posterRedFlags;
  }

  if (typeof posterOverride.footer_badge === "string" && posterOverride.footer_badge.trim()) {
    posterSpec.footer_badge = posterOverride.footer_badge.trim();
  }

  if (typeof posterOverride.source_tag === "string" && posterOverride.source_tag.trim()) {
    posterSpec.source_tag = posterOverride.source_tag.trim();
  }

  return next;
}
