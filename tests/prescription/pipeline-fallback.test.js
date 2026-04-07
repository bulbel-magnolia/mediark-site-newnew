import assert from "node:assert/strict";

import { generatePrescriptionBundle } from "../../js/prescription/pipeline.js";

const bundle = await generatePrescriptionBundle({
  patient: {
    id: "fallback-case-1",
    name: "Alex Tan",
    diagnosis: "Post-op esophageal cancer recovery",
    stage: "Week 1",
    tags: ["high-anxiety"],
    compliance: 80
  },
  formInput: {
    language: "en-US",
    focusTopics: ["Diet", "Red flags"],
    doctorNotes: "Use calm language."
  },
  runtime: {
    config: {
      mode: "live",
      providers: {
        text_master: {
          label: "Master JSON",
          provider: "openai-compatible",
          model: "gpt-5.4",
          baseUrl: "https://xchai.xyz/v1",
          apiKey: "test-key"
        },
        text_reviewer: {
          label: "Clinical Reviewer",
          provider: "openai-compatible",
          model: "gpt-5.4",
          baseUrl: "https://xchai.xyz/v1",
          apiKey: "test-key"
        },
        image_main: {
          label: "Poster / Visual Assets",
          provider: "openai-compatible",
          model: "gemini-3-pro-image-preview",
          baseUrl: "https://xchai.xyz/v1",
          apiKey: "test-key"
        },
        video_main: {
          label: "Short Clinical Video",
          provider: "seedance",
          model: "seedance-2.0",
          baseUrl: "",
          apiKey: ""
        },
        audio_main: {
          label: "Narration",
          provider: "openai-compatible",
          model: "tts-placeholder",
          baseUrl: "",
          apiKey: ""
        }
      }
    },
    sleep: async () => {},
    fetchImpl: async (url) => ({
      ok: false,
      status: 503,
      json: async () => ({
        error: {
          code: "model_not_found",
          message: `Unavailable route for ${url}`
        }
      }),
      text: async () => JSON.stringify({
        error: {
          code: "model_not_found",
          message: `Unavailable route for ${url}`
        }
      })
    })
  }
});

assert.equal(bundle.mode, "live");
assert.equal(bundle.masterJson.status.text_master, "provider-unavailable");
assert.equal(bundle.masterJson.status.image_generation, "provider-unavailable");
assert.equal(bundle.masterJson.spec.clinical_core.clinical_summary, "Post-op esophageal cancer recovery should focus on Diet, Red flags for patient education.");
assert.equal(bundle.diagnostics.find((item) => item.role === "text_master").routeStatus, "provider-unavailable");
assert.equal(bundle.diagnostics.find((item) => item.role === "image_main").routeStatus, "provider-unavailable");

console.log("pipeline-fallback.test.js passed");
