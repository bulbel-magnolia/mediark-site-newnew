import { generatePrescriptionBundle } from "../../js/prescription/pipeline.js";
import { inferCancerType } from "./cancer-type-resolver.js";
import { retrieveClinicalDefaults } from "./clinical-defaults-retriever.js";
import { retrieveEvidenceForTopics } from "./knowledge-retriever.js";

function normalizeInput(input = {}) {
  const formatStr = String(input.work?.format || "poster-text");
  const enabledFormats = new Set(formatStr.split("-").filter(Boolean));

  return {
    patient: {
      id: input.patient?.id || `case-${Date.now()}`,
      name: input.patient?.name || "Unnamed Patient",
      diagnosis: input.patient?.diagnosis || "General recovery education",
      stage: input.patient?.stage || "Follow-up",
      cancerType: input.patient?.cancerType || inferCancerType(input.patient?.diagnosis) || "esophageal"
    },
    form: {
      language: input.form?.language || "zh-CN",
      focusTopics: Array.isArray(input.form?.focusTopics) ? input.form.focusTopics : [],
      doctorNotes: input.form?.doctorNotes || "",
      videoDurationSec: input.form?.videoDurationSec
    },
    work: {
      title: input.work?.title || "",
      topic: input.work?.topic || "",
      format: input.work?.format || "",
      audience: input.work?.audience || ""
    },
    enabledFormats: [...enabledFormats]
  };
}

export async function generateWorkBundle({ input, runtime = {}, db = null }) {
  const normalizedInput = normalizeInput(input);
  const formats = new Set(normalizedInput.enabledFormats);

  const cancerType = normalizedInput.patient.cancerType;

  const evidenceResult = db
    ? retrieveEvidenceForTopics(db, {
        focusTopics: normalizedInput.form.focusTopics,
        cancerType
      })
    : null;

  const evidence = evidenceResult?.entries || null;
  const matchedCategories = evidenceResult?.matchedCategories || [];

  const clinicalDefaults = db
    ? retrieveClinicalDefaults(db, {
        cancerType,
        categories: matchedCategories.length ? matchedCategories : ["nutrition", "rehabilitation"],
        language: normalizedInput.form.language
      })
    : null;

  const bundle = await generatePrescriptionBundle({
    patient: normalizedInput.patient,
    formInput: normalizedInput.form,
    runtime: {
      ...runtime
    },
    skipVideoPolling: true,
    enabledFormats: {
      text: true,
      poster: formats.has("poster"),
      image: formats.has("image"),
      video: formats.has("video")
    },
    evidenceOverride: evidence,
    clinicalDefaultsOverride: clinicalDefaults
  });

  return {
    input: normalizedInput,
    bundle,
    workMeta: {
      title: normalizedInput.work.title || bundle.posterPayload.title || normalizedInput.patient.name,
      topic: normalizedInput.work.topic || normalizedInput.patient.diagnosis,
      format: normalizedInput.work.format || "poster-video",
      audience: normalizedInput.work.audience || "patient"
    }
  };
}
