import assert from "node:assert/strict";

import { requestVideoGeneration } from "../../js/prescription/provider-clients.js";

const provider = {
  label: "Short Clinical Video",
  provider: "byteplus-modelark",
  model: "seedance-1-5-pro-251215",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  apiKey: "test-key"
};

const videoSpec = {
  duration_sec: 8,
  shots: [
    {
      id: "shot_1",
      reference_asset_id: "scene_reference",
      motion_prompt: "Doctor calmly explains recovery steps to the patient.",
      caption: "Recovery steps"
    }
  ]
};

const imageArtifacts = [
  {
    id: "scene_reference",
    path: "https://cdn.example.com/reference.png"
  }
];

const requests = [];
let pollCount = 0;

const generatedVideo = await requestVideoGeneration({
  provider,
  videoSpec,
  imageArtifacts,
  fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });

    if (url.endsWith("/contents/generations/tasks")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "task_video_123",
          status: "queued"
        }),
        text: async () => ""
      };
    }

    if (url.endsWith("/contents/generations/tasks/task_video_123")) {
      pollCount += 1;

      if (pollCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "task_video_123",
            status: "running"
          }),
          text: async () => ""
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "task_video_123",
          status: "succeeded",
          content: [
            {
              type: "video_url",
              video_url: {
                url: "https://cdn.example.com/generated-video.mp4",
                cover_url: "https://cdn.example.com/generated-video-cover.jpg"
              }
            }
          ]
        }),
        text: async () => ""
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  },
  sleep: async () => {}
});

assert.equal(requests[0].url, "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks");
assert.equal(requests[0].options.method, "POST");

const createPayload = JSON.parse(requests[0].options.body);
assert.equal(createPayload.model, "seedance-1-5-pro-251215");
assert.equal(createPayload.content[0].type, "text");
assert.match(createPayload.content[0].text, /--duration 8/);
assert.equal(createPayload.content[1].type, "image_url");
assert.equal(createPayload.content[1].image_url.url, "https://cdn.example.com/reference.png");

assert.equal(generatedVideo.status, "generated");
assert.equal(generatedVideo.taskId, "task_video_123");
assert.equal(generatedVideo.path, "https://cdn.example.com/generated-video.mp4");
assert.equal(generatedVideo.thumbnail, "https://cdn.example.com/generated-video-cover.jpg");
assert.equal(pollCount, 2);

const unavailableVideo = await requestVideoGeneration({
  provider,
  videoSpec: {
    shots: [{ motion_prompt: "Short clinical education scene." }]
  },
  imageArtifacts: [],
  fetchImpl: async () => ({
    ok: false,
    status: 404,
    json: async () => ({
      error: {
        code: "model_not_found",
        message: "Model is not available for this account."
      }
    }),
    text: async () => JSON.stringify({
      error: {
        code: "model_not_found",
        message: "Model is not available for this account."
      }
    })
  }),
  sleep: async () => {}
});

assert.equal(unavailableVideo.status, "provider-unavailable");
assert.equal(unavailableVideo.errorCode, "model_not_found");

console.log("provider-clients-video.test.js passed");
