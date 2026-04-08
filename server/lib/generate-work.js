import { generatePrescriptionBundle } from "../../js/prescription/pipeline.js";

function normalizeInput(input = {}) {
  return {
    patient: {
      id: input.patient?.id || `case-${Date.now()}`,
      name: input.patient?.name || "Unnamed Patient",
      diagnosis: input.patient?.diagnosis || "General recovery education",
      stage: input.patient?.stage || "Follow-up"
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
    }
  };
}

export async function generateWorkBundle({ input, runtime = {} }) {
  const normalizedInput = normalizeInput(input);
  const bundle = await generatePrescriptionBundle({
    patient: normalizedInput.patient,
    formInput: normalizedInput.form,
    runtime: {
      ...runtime
    },
    skipVideoPolling: true
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
