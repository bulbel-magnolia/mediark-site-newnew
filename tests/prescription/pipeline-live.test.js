import assert from "node:assert/strict";

import { generatePrescriptionBundle } from "../../js/prescription/pipeline.js";

const patient = {
  id: "live-case-1",
  name: "Alex Tan",
  diagnosis: "Post-op esophageal cancer recovery",
  stage: "Week 1",
  tags: ["high-anxiety"],
  compliance: 80
};

const formInput = {
  language: "en-US",
  focusTopics: ["Diet", "Red flags"],
  doctorNotes: "Use calm language."
};

const runtime = {
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
        provider: "byteplus-modelark",
        model: "seedance-1-5-pro-251215",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: "test-key"
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
  fetchCallLog: [],
  fetchImpl: async (url) => {
    runtime.fetchCallLog.push(url);

    if (url.endsWith("/chat/completions")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  clinical_summary: "Live refined summary.",
                  must_know: ["Eat slowly", "Choose soft foods", "Watch red flags"],
                  must_do: ["Small meals", "Warm fluids", "Review daily"],
                  must_avoid: ["Hard foods", "Large bites", "Ignoring pain"],
                  red_flags: ["Vomiting", "Chest pain", "Cannot swallow"],
                  copy_master: {
                    one_sentence_takeaway: "Go slowly and escalate warning signs early.",
                    short_summary: "Diet and warning-sign education come first.",
                    narration_script: "Use soft foods, eat slowly, and call the team if warning signs appear.",
                    doctor_review_note: "Pending clinician review before release."
                  },
                  poster_spec: {
                    title: "Recovery diet guide",
                    subtitle: "Early recovery education",
                    key_points: ["Eat slowly", "Soft foods", "Red flags"],
                    do_list: ["Small meals", "Warm fluids", "Review plan"],
                    dont_list: ["Hard foods", "Fast eating", "Ignore pain"],
                    red_flags: ["Vomiting", "Chest pain", "Cannot swallow"],
                    footer_badge: "Doctor reviewed",
                    source_tag: "Evidence bundle"
                  }
                })
              }
            }
          ]
        }),
        text: async () => ""
      };
    }

    if (url.endsWith("/images/generations")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              url: "https://cdn.example.com/hero-image.png"
            }
          ]
        }),
        text: async () => ""
      };
    }

    if (url.endsWith("/contents/generations/tasks")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "video_task_live_1",
          status: "queued"
        }),
        text: async () => ""
      };
    }

    if (url.endsWith("/contents/generations/tasks/video_task_live_1")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "video_task_live_1",
          status: "succeeded",
          content: [
            {
              type: "video_url",
              video_url: {
                url: "https://cdn.example.com/video-live.mp4",
                cover_url: "https://cdn.example.com/video-live-cover.jpg"
              }
            }
          ]
        }),
        text: async () => ""
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  }
};

const bundle = await generatePrescriptionBundle({
  patient,
  formInput,
  runtime
});

assert.equal(bundle.mode, "live");
assert.equal(bundle.masterJson.spec.clinical_core.clinical_summary, "Live refined summary.");
assert.equal(bundle.masterJson.review.doctor_review_required, true);
assert.equal(bundle.masterJson.artifacts.images[0].status, "generated");
assert.equal(bundle.masterJson.artifacts.images[0].provider, "openai-compatible");
assert.equal(bundle.masterJson.status.image_generation, "generated");
assert.equal(bundle.masterJson.artifacts.videos[0].status, "generated");
assert.equal(bundle.masterJson.artifacts.videos[0].path, "https://cdn.example.com/video-live.mp4");
assert.equal(bundle.masterJson.status.video_generation, "generated");
assert.equal(bundle.masterJson.status.poster_render, "browser-ready");
assert.equal(bundle.diagnostics.find((item) => item.role === "text_master").liveReady, true);
assert.equal(bundle.diagnostics.find((item) => item.role === "image_main").liveReady, true);
assert.equal(bundle.diagnostics.find((item) => item.role === "video_main").routeStatus, "generated");
assert.ok(runtime.fetchCallLog.some((url) => url.endsWith("/contents/generations/tasks")));

console.log("pipeline-live.test.js passed");
