import { extractJsonObject } from "./live-refinement.js";

function stripTrailingSlash(value = "") {
  return String(value).replace(/\/+$/, "");
}

function buildUrl(baseUrl, path) {
  return `${stripTrailingSlash(baseUrl)}${path}`;
}

function normalizeChatContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractResponseText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  // Standard OpenAI /chat/completions format
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (messageContent) {
    return normalizeChatContent(messageContent);
  }

  // Doubao /responses format: output is array of {type, content/summary}
  const outputArray = payload?.output;
  if (Array.isArray(outputArray)) {
    // Find the "message" type output (skip "reasoning")
    const messageOutput = outputArray.find((item) => item?.type === "message");
    if (messageOutput?.content) {
      const contentArray = Array.isArray(messageOutput.content) ? messageOutput.content : [];
      const textItem = contentArray.find((item) => item?.type === "output_text");
      if (textItem?.text) {
        return String(textItem.text).trim();
      }
    }
    // Fallback: try first output's content
    const firstContent = outputArray[0]?.content;
    if (firstContent) {
      return normalizeChatContent(firstContent);
    }
  }

  return "";
}

async function readErrorPayload(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    try {
      payload = { error: { message: await response.text() } };
    } catch {
      payload = { error: { message: "Unknown provider error." } };
    }
  }

  return payload;
}

export async function requestTextRefinement({ provider, prompt, fetchImpl }) {
  const useResponsesApi = provider.apiStyle === "doubao-responses"
    || provider.model?.startsWith("doubao-seed");

  let endpoint, body;

  if (useResponsesApi) {
    // Doubao /responses API format
    endpoint = "/responses";
    body = {
      model: provider.model,
      input: [
        { role: "system", content: "Return one JSON object only. No markdown, no explanation." },
        { role: "user", content: [{ type: "input_text", text: prompt }] }
      ]
    };
  } else {
    // Standard OpenAI /chat/completions format
    endpoint = "/chat/completions";
    body = {
      model: provider.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return one JSON object only." },
        { role: "user", content: prompt }
      ]
    };
  }

  const response = await fetchImpl(buildUrl(provider.baseUrl, endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const error = new Error(payload?.error?.message || "Text refinement failed.");
    error.code = payload?.error?.code || "provider_error";
    throw error;
  }

  const payload = await response.json();
  const text = extractResponseText(payload);

  return extractJsonObject(text);
}

function resolveImagePath(data = {}) {
  const firstItem = data?.data?.[0] || {};

  if (typeof firstItem.url === "string" && firstItem.url.trim()) {
    return firstItem.url;
  }

  if (typeof firstItem.b64_json === "string" && firstItem.b64_json.trim()) {
    return `data:image/png;base64,${firstItem.b64_json}`;
  }

  return "";
}

function resolveImageSize(asset = {}) {
  if (asset.aspect_ratio === "16:9") {
    return "2560x1440";
  }

  return "1728x2160";
}

function normalizeDurationSec(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric);
}

function resolveVideoDurationSec(videoSpec = {}, provider = {}) {
  const explicitDuration = normalizeDurationSec(videoSpec.duration_sec);

  if (explicitDuration) {
    return explicitDuration;
  }

  const shotDuration = (videoSpec.shots || []).reduce((total, shot) => {
    const current = normalizeDurationSec(shot?.duration_sec);
    return total + (current || 0);
  }, 0);

  if (shotDuration > 0) {
    return shotDuration;
  }

  return normalizeDurationSec(provider.defaultDurationSec) || 5;
}

function resolveReferenceImageUrl(videoSpec = {}, imageArtifacts = []) {
  const referenceIds = (videoSpec.shots || [])
    .map((shot) => shot?.reference_asset_id)
    .filter(Boolean);

  for (const referenceId of referenceIds) {
    const artifact = imageArtifacts.find((item) => item?.id === referenceId);
    const path = String(artifact?.path || "").trim();

    if (path.startsWith("https://") || path.startsWith("http://")) {
      // Skip signed/temporary CDN URLs that the video provider cannot access
      if (path.includes("X-Tos-Signature") || path.includes("X-Amz-Signature") || path.includes("Expires=")) {
        continue;
      }
      return path;
    }
  }

  return "";
}

function buildVideoPrompt(videoSpec = {}, provider = {}) {
  // Use only the first shot's motion_prompt to keep the prompt concise
  const shots = videoSpec.shots || [];
  const firstPrompt = shots.find((s) => s?.motion_prompt)?.motion_prompt;

  if (firstPrompt) {
    return String(firstPrompt).trim();
  }

  return "A calm clinical education video for patient recovery guidance, warm hospital setting, gentle camera motion.";
}

function resolveVideoResult(payload = {}) {
  const content = payload.content || {};
  const contentArray = Array.isArray(content) ? content : [];
  const contentItem = contentArray.find((item) => item?.type === "video_url");
  const nestedVideo = contentItem?.video_url || {};
  const output = payload.output || {};
  const firstVideo = Array.isArray(output.videos) ? output.videos[0] || {} : {};
  const dataItem = Array.isArray(payload.data) ? payload.data[0] || {} : {};

  const path = nestedVideo.url
    || content.video_url
    || output.video_url
    || output.videoUrl
    || firstVideo.url
    || dataItem.url
    || "";

  const thumbnail = nestedVideo.cover_url
    || nestedVideo.poster_url
    || content.cover_url
    || content.thumbnail_url
    || output.cover_url
    || output.coverUrl
    || firstVideo.cover_url
    || firstVideo.thumbnail_url
    || dataItem.cover_url
    || "";

  return {
    path: String(path || "").trim(),
    thumbnail: String(thumbnail || "").trim()
  };
}

function resolveTaskStatus(payload = {}) {
  return String(
    payload.status
      || payload.state
      || payload.task_status
      || payload.taskStatus
      || ""
  ).trim().toLowerCase();
}

function resolveTaskId(payload = {}) {
  return String(
    payload.id
      || payload.task_id
      || payload.taskId
      || ""
  ).trim();
}

function isSucceededStatus(status) {
  return ["succeeded", "success", "completed", "finished"].includes(status);
}

function isFailedStatus(status) {
  return ["failed", "error", "cancelled", "canceled", "rejected", "expired"].includes(status);
}

export async function requestVideoGeneration({
  provider,
  videoSpec = {},
  imageArtifacts = [],
  fetchImpl,
  sleep
}) {
  // Always use real setTimeout for polling — callers may pass a no-op sleep for tests
  const pollSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const taskResponse = await fetchImpl(buildUrl(provider.baseUrl, "/contents/generations/tasks"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      content: [
        {
          type: "text",
          text: buildVideoPrompt(videoSpec, provider)
        },
        ...(() => {
          const referenceImageUrl = resolveReferenceImageUrl(videoSpec, imageArtifacts);

          if (!referenceImageUrl) {
            return [];
          }

          return [
            {
              type: "image_url",
              image_url: {
                url: referenceImageUrl
              }
            }
          ];
        })()
      ]
    })
  });

  if (!taskResponse.ok) {
    const payload = await readErrorPayload(taskResponse);
    const errorCode = payload?.error?.code || "provider_error";

    return {
      id: videoSpec.id || "short_video",
      provider: provider.provider,
      model: provider.model,
      status: errorCode === "model_not_found" ? "provider-unavailable" : "generation-failed",
      path: "",
      thumbnail: "",
      errorCode,
      errorMessage: payload?.error?.message || "Video generation failed."
    };
  }

  const taskPayload = await taskResponse.json();
  const taskId = resolveTaskId(taskPayload);

  if (!taskId) {
    return {
      id: videoSpec.id || "short_video",
      provider: provider.provider,
      model: provider.model,
      status: "generation-failed",
      path: "",
      thumbnail: "",
      errorCode: "missing_task_id",
      errorMessage: "Video task created without a task id."
    };
  }

  const maxPollAttempts = Number(provider.maxPollAttempts) > 0 ? Number(provider.maxPollAttempts) : 60;
  const pollIntervalMs = Number(provider.pollIntervalMs) > 0 ? Number(provider.pollIntervalMs) : 5000;

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const statusResponse = await fetchImpl(buildUrl(provider.baseUrl, `/contents/generations/tasks/${taskId}`), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`
      }
    });

    if (!statusResponse.ok) {
      const payload = await readErrorPayload(statusResponse);
      const errorCode = payload?.error?.code || "provider_error";

      return {
        id: videoSpec.id || "short_video",
        provider: provider.provider,
        model: provider.model,
        status: errorCode === "model_not_found" ? "provider-unavailable" : "generation-failed",
        taskId,
        path: "",
        thumbnail: "",
        errorCode,
        errorMessage: payload?.error?.message || "Video generation polling failed."
      };
    }

    const statusPayload = await statusResponse.json();
    const status = resolveTaskStatus(statusPayload);

    if (isSucceededStatus(status)) {
      const result = resolveVideoResult(statusPayload);

      return {
        id: videoSpec.id || "short_video",
        provider: provider.provider,
        model: provider.model,
        status: "generated",
        taskId,
        path: result.path,
        thumbnail: result.thumbnail
      };
    }

    if (isFailedStatus(status)) {
      return {
        id: videoSpec.id || "short_video",
        provider: provider.provider,
        model: provider.model,
        status: "generation-failed",
        taskId,
        path: "",
        thumbnail: "",
        errorCode: status || "task_failed",
        errorMessage: "Video generation task failed."
      };
    }

    if (attempt < maxPollAttempts - 1) {
      await pollSleep(pollIntervalMs);
    }
  }

  return {
    id: videoSpec.id || "short_video",
    provider: provider.provider,
    model: provider.model,
    status: "generation-failed",
    taskId,
    path: "",
    thumbnail: "",
    errorCode: "poll_timeout",
    errorMessage: "Video generation timed out while polling task status."
  };
}

export async function requestImageGeneration({ provider, asset, fetchImpl }) {
  const response = await fetchImpl(buildUrl(provider.baseUrl, "/images/generations"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      prompt: asset.prompt,
      size: resolveImageSize(asset)
    })
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const errorCode = payload?.error?.code || "provider_error";

    return {
      id: asset.id,
      role: asset.role,
      provider: provider.provider,
      model: provider.model,
      status: errorCode === "model_not_found" ? "provider-unavailable" : "generation-failed",
      path: "",
      prompt: asset.prompt,
      errorCode,
      errorMessage: payload?.error?.message || "Image generation failed."
    };
  }

  const payload = await response.json();

  return {
    id: asset.id,
    role: asset.role,
    provider: provider.provider,
    model: provider.model,
    status: "generated",
    path: resolveImagePath(payload),
    prompt: asset.prompt
  };
}
