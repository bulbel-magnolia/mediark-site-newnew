import { MEDIARK_CONFIG } from "../config/api-config.js";
import { buildMasterJson } from "./master-schema.js";
import { buildEvidenceBundle, buildMockArtifacts } from "./mock-data.js";
import { buildPosterPayload } from "./poster-renderer.js";
import { applyCopyRefinement, buildTextRefinementPrompt } from "./live-refinement.js";
import { interpretPatientProfile } from "./profile-interpreter.js";
import { requestImageGeneration, requestTextRefinement, requestVideoGeneration } from "./provider-clients.js";

// 把 patient profile 翻译成给图片模型的风格提示（简短英文词条）
function profileToImageStyleHints(profile) {
  const hints = [];
  if (profile.literacy === "plain") hints.push("simple composition, clear direct visual metaphors");
  if (profile.literacy === "advanced") hints.push("detailed clinical accuracy, data-rich scene");
  if (profile.tone === "reassuring") hints.push("warm hopeful atmosphere, soft natural lighting");
  if (profile.tone === "gentle") hints.push("calm gentle mood, soft pastel tones");
  if (profile.formatPreference === "video") hints.push("dynamic composition suitable for motion");
  if (profile.formatPreference === "poster") hints.push("bold poster-friendly layout with ample negative space");
  return hints.join(", ");
}

// 把 patient profile 翻译成给视频模型的风格提示
function profileToVideoStyleHints(profile) {
  const hints = [];
  if (profile.literacy === "plain") hints.push("slow-paced, simple visual beats, 1 idea per shot");
  if (profile.literacy === "advanced") hints.push("informative data visualization, medical infographic style");
  if (profile.tone === "reassuring") hints.push("warm reassuring atmosphere, soft transitions");
  if (profile.formatPreference === "video") hints.push("short-form vertical-friendly pacing, attention-grabbing opening");
  return hints.join(", ");
}

function buildEvidenceContextSnippet(evidence = [], maxLength = 120) {
  if (!evidence.length) return "";

  const points = [];
  for (const entry of evidence) {
    // Prefer title (often has English version) for image/video prompts
    if (entry.title && typeof entry.title === "string") {
      points.push(entry.title.trim());
    }
  }

  if (!points.length) return "";

  // Keep only short, ASCII-safe entries for image/video API compatibility
  const selected = [...new Set(points)]
    .filter((p) => p.length <= 60)
    .slice(0, 2);

  const snippet = selected.join("; ");
  return snippet.length <= maxLength ? snippet : `${snippet.slice(0, maxLength - 1)}…`;
}

function createImageSpec(patient, focusTopics = [], evidence = [], profile = null) {
  const primaryTopic = focusTopics[0] || "recovery education";
  const diagnosis = patient?.diagnosis || "oncology recovery";
  const evidenceContext = buildEvidenceContextSnippet(evidence, 100);
  const contextClause = evidenceContext ? `, clinical context: ${evidenceContext}` : "";
  const profileHints = profile ? profileToImageStyleHints(profile) : "";
  const profileClause = profileHints ? `, ${profileHints}` : "";

  // 根据 profile 调整调色板
  let palette = ["#0F4C81", "#D9EAF7", "#F7FBFF"];
  if (profile?.tone === "reassuring" || profile?.tone === "gentle") {
    palette = ["#2563eb", "#dbeafe", "#fef3c7"]; // 更温暖
  }

  return {
    style: "clinical_education_first",
    palette,
    assets: [
      {
        id: "hero_image",
        role: "poster_hero",
        purpose: "Poster hero visual",
        prompt: `A realistic patient education poster scene for ${diagnosis}, focused on ${primaryTopic}${contextClause}${profileClause}, warm clinical lighting, calm hospital counseling moment, clean background, no text overlay.`,
        negative_prompt: "blood, surgery close-up, distorted body, extra fingers, horror, text overlay",
        aspect_ratio: "4:5"
      },
      {
        id: "scene_reference",
        role: "video_reference",
        purpose: "Short video reference frame",
        prompt: `A realistic short-form clinical education scene for ${diagnosis}, focused on ${primaryTopic}${contextClause}${profileClause}, doctor or nurse explaining recovery steps to a patient, steady composition, no text overlay.`,
        negative_prompt: "horror, distorted face, extra limbs, surreal objects, text overlay",
        aspect_ratio: "16:9"
      }
    ]
  };
}

function createVideoSpec(patient, focusTopics = [], formInput = {}, evidence = [], profile = null) {
  const message = focusTopics.join(", ") || "recovery education";
  const stage = patient?.stage || "recovery";
  const diagnosis = patient?.diagnosis || "recovery care";
  const requestedDurationSec = Number(formInput?.videoDurationSec);
  const evidenceContext = buildEvidenceContextSnippet(evidence, 150);
  const contextClause = evidenceContext ? `, key guidance: ${evidenceContext}` : "";
  const profileHints = profile ? profileToVideoStyleHints(profile) : "";
  const profileClause = profileHints ? `, ${profileHints}` : "";

  return {
    ...(Number.isFinite(requestedDurationSec) && requestedDurationSec > 0
      ? { duration_sec: Math.round(requestedDurationSec) }
      : {}),
    shots: [
      {
        id: "shot_1",
        reference_asset_id: "scene_reference",
        motion_prompt: `Animated clinical education scene about ${diagnosis} during ${stage}${contextClause}${profileClause}, blue and white infographic style, gentle camera motion, icon-led recovery guidance, emphasize ${message}, no surgery, no blood, no invasive procedures, no text overlay.`,
        caption: `${stage}: ${message}`
      },
      {
        id: "shot_2",
        reference_asset_id: "hero_image",
        motion_prompt: `Medical explainer animation highlighting ${message}${contextClause}${profileClause}, clean clinical atmosphere, calm educational visual language, infographic motion graphics, no sensitive treatment content, no text overlay.`,
        caption: `Key education points: ${message}`
      }
    ]
  };
}

function hasRuntimeCredentials(config, role) {
  const provider = config?.providers?.[role];
  return Boolean(provider?.baseUrl && provider?.apiKey);
}

function buildProviderDiagnostics(config, routeStatus = {}) {
  return Object.entries(config?.providers || {}).map(([role, provider]) => ({
    role,
    ...provider,
    liveReady: hasRuntimeCredentials(config, role),
    routeStatus: routeStatus[role] || (hasRuntimeCredentials(config, role) ? "configured" : "needs-config")
  }));
}

function resolveRuntime(runtime = {}) {
  return {
    config: runtime.config || MEDIARK_CONFIG,
    fetchImpl: runtime.fetchImpl || globalThis.fetch?.bind(globalThis),
    sleep: runtime.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  };
}

function resolveMode(config) {
  return config?.mode || "mock";
}

async function buildVideoArtifacts({ config, mode, masterJson, imageArtifacts, fetchImpl, sleep }) {
  if (mode === "mock") {
    return buildMockArtifacts().videos;
  }

  const provider = config.providers.video_main;

  if (!hasRuntimeCredentials(config, "video_main") || !fetchImpl) {
    return [
      {
        id: "short_video",
        provider: provider.provider,
        model: provider.model,
        status: "queued",
        thumbnail: "",
        path: ""
      }
    ];
  }

  return [
    await requestVideoGeneration({
      provider,
      videoSpec: masterJson.spec.video_spec,
      imageArtifacts,
      fetchImpl,
      sleep
    })
  ];
}

function buildAudioArtifacts(config, mode) {
  if (mode === "mock") {
    return buildMockArtifacts().audio;
  }

  const provider = config.providers.audio_main;

  return [
    {
      id: "narration",
      provider: provider.provider,
      model: provider.model,
      status: hasRuntimeCredentials(config, "audio_main") ? "configured" : "queued",
      path: ""
    }
  ];
}

function resolveImageStatus(images = []) {
  const statuses = images.map((item) => item.status);

  if (!statuses.length) {
    return "pending";
  }

  if (statuses.includes("provider-unavailable")) {
    return "provider-unavailable";
  }

  if (statuses.includes("generation-failed")) {
    return "generation-failed";
  }

  if (statuses.every((status) => status === "generated")) {
    return "generated";
  }

  if (statuses.includes("configured")) {
    return "configured";
  }

  if (statuses.includes("queued")) {
    return "queued";
  }

  return statuses[0];
}

function updateStatuses(masterJson, artifacts, mode, textStatus = "ready") {
  masterJson.status.text_master = textStatus;
  masterJson.status.image_generation = resolveImageStatus(artifacts.images);
  masterJson.status.video_generation = mode === "mock" ? "queued" : artifacts.videos[0]?.status || "pending";
  masterJson.status.audio_generation = mode === "mock" ? "queued" : artifacts.audio[0]?.status || "pending";
  masterJson.status.poster_render = "browser-ready";
  return masterJson;
}

async function refineMasterJsonIfLive({ masterJson, patient, formInput, evidence, config, fetchImpl }) {
  const provider = config.providers.text_master;

  if (resolveMode(config) === "mock" || !hasRuntimeCredentials(config, "text_master") || !fetchImpl) {
    return {
      masterJson,
      routeStatus: resolveMode(config) === "mock" ? "mock-ready" : "needs-config"
    };
  }

  try {
    const prompt = buildTextRefinementPrompt({
      patient,
      formInput,
      evidence,
      draftMasterJson: masterJson
    });

    const refinement = await requestTextRefinement({
      provider,
      prompt,
      fetchImpl
    });

    return {
      masterJson: applyCopyRefinement(masterJson, refinement),
      routeStatus: "ready"
    };
  } catch (error) {
    const msg = String(error?.message || error || "unknown");
    console.warn("Text refinement fell back to deterministic draft:", msg);
    return {
      masterJson,
      routeStatus: error?.code === "model_not_found" ? "provider-unavailable" : "fallback",
      errorDetail: msg
    };
  }
}

async function buildImageArtifacts({ masterJson, config, fetchImpl }) {
  const provider = config.providers.image_main;
  const assets = masterJson.spec.image_spec.assets || [];

  if (!assets.length) {
    return [];
  }

  if (!hasRuntimeCredentials(config, "image_main") || !fetchImpl) {
    return assets.map((asset) => ({
      id: asset.id,
      role: asset.role,
      provider: provider.provider,
      model: provider.model,
      status: "queued",
      path: "",
      prompt: asset.prompt
    }));
  }

  const images = [];

  for (const asset of assets) {
    try {
      images.push(await requestImageGeneration({
        provider,
        asset,
        fetchImpl
      }));
    } catch (err) {
      console.warn(`Image generation failed for ${asset.id}:`, err?.message || err);
      images.push({
        id: asset.id,
        role: asset.role,
        provider: provider.provider,
        model: provider.model,
        status: "generation-failed",
        path: "",
        prompt: asset.prompt,
        errorMessage: String(err?.message || "Unknown error")
      });
    }
  }

  return images;
}

async function buildArtifacts({ masterJson, config, fetchImpl, mode, sleep, skipVideoPolling = false, enabledFormats = {} }) {
  if (mode === "mock") {
    const mock = buildMockArtifacts();
    // 在 mock 模式下也尊重格式选择
    if (enabledFormats.image === false) mock.images = [];
    if (enabledFormats.video === false) mock.videos = [];
    return mock;
  }

  // 图片：仅在勾选了 image 或 poster 时生成（poster 需要 hero_image）
  const needImages = enabledFormats.image !== false || enabledFormats.poster !== false;
  const images = needImages
    ? await buildImageArtifacts({ masterJson, config, fetchImpl })
    : [];

  // 视频：仅在勾选了 video 时生成
  let videos = [];
  if (enabledFormats.video !== false) {
    if (skipVideoPolling) {
      videos = await buildVideoTaskOnly({ masterJson, imageArtifacts: images, config, fetchImpl });
    } else {
      videos = await buildVideoArtifacts({
        masterJson,
        imageArtifacts: images,
        config,
        fetchImpl,
        mode,
        sleep
      });
    }
  }

  return {
    images,
    videos,
    audio: buildAudioArtifacts(config, mode),
    poster: {
      html: enabledFormats.poster !== false ? "browser-generated" : "",
      png: "",
      pdf: ""
    }
  };
}

async function buildVideoTaskOnly({ masterJson, imageArtifacts, config, fetchImpl }) {
  const provider = config.providers.video_main;

  if (!hasRuntimeCredentials(config, "video_main") || !fetchImpl) {
    return [{ id: "short_video", provider: provider.provider, model: provider.model, status: "queued", path: "", thumbnail: "" }];
  }

  try {
    const { buildUrl: _bu, buildVideoPrompt: _bvp } = await import("./provider-clients.js").then(() => ({})).catch(() => ({}));

    const videoSpec = masterJson.spec.video_spec || {};
    const shots = videoSpec.shots || [];
    const firstPrompt = shots.find((s) => s?.motion_prompt)?.motion_prompt || "A calm clinical education video for patient recovery guidance.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let taskResponse;
    try {
      taskResponse = await fetchImpl(`${provider.baseUrl.replace(/\/+$/, "")}/contents/generations/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ model: provider.model, content: [{ type: "text", text: firstPrompt }] }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!taskResponse.ok) {
      return [{ id: "short_video", provider: provider.provider, model: provider.model, status: "generation-failed", path: "", thumbnail: "" }];
    }

    const taskPayload = await taskResponse.json();
    const taskId = String(taskPayload.id || taskPayload.task_id || "").trim();

    return [{
      id: "short_video",
      provider: provider.provider,
      model: provider.model,
      status: taskId ? "processing" : "generation-failed",
      taskId: taskId,
      path: "",
      thumbnail: ""
    }];
  } catch {
    return [{ id: "short_video", provider: provider.provider, model: provider.model, status: "generation-failed", path: "", thumbnail: "" }];
  }
}

export async function generatePrescriptionBundle({ patient, formInput, runtime = {}, skipVideoPolling = false, enabledFormats = {}, evidenceOverride = null, clinicalDefaultsOverride = null }) {
  const { config, fetchImpl, sleep } = resolveRuntime(runtime);
  const mode = resolveMode(config);
  const evidence = evidenceOverride || buildEvidenceBundle(formInput.focusTopics);

  // 默认全部启用（向后兼容前端直接调用的情况）
  const formats = {
    text: enabledFormats.text !== false,
    poster: enabledFormats.poster !== false,
    image: enabledFormats.image !== false,
    video: enabledFormats.video !== false
  };

  let masterJson = buildMasterJson({ patient, formInput, evidence, clinicalDefaults: clinicalDefaultsOverride });

  // 解释患者画像，一次性供给图片/视频/文本 prompt 共享
  const profile = interpretPatientProfile(patient?.tags, patient?.notes);

  masterJson.spec.image_spec = (formats.image || formats.poster)
    ? createImageSpec(patient, formInput.focusTopics, evidence, profile)
    : { assets: [] };
  masterJson.spec.video_spec = formats.video
    ? createVideoSpec(patient, formInput.focusTopics, formInput, evidence, profile)
    : { shots: [] };
  masterJson.spec.audio_spec = {
    voice_style: "warm_clinical",
    language: formInput.language,
    script_source: "spec.copy_master.narration_script"
  };

  const textRefinement = await refineMasterJsonIfLive({
    masterJson,
    patient,
    formInput,
    evidence,
    config,
    fetchImpl
  });
  masterJson = textRefinement.masterJson;

  const artifacts = await buildArtifacts({
    masterJson,
    config,
    fetchImpl,
    mode,
    sleep,
    skipVideoPolling,
    enabledFormats: formats
  });

  masterJson.artifacts = artifacts;
  updateStatuses(masterJson, artifacts, mode, textRefinement.routeStatus);

  // 透传 LLM 错误信息到前端（调试用）
  if (textRefinement.errorDetail) {
    masterJson._textError = textRefinement.errorDetail;
  }

  const providerRouteStatus = {
    text_master: textRefinement.routeStatus,
    text_reviewer: hasRuntimeCredentials(config, "text_reviewer") ? "configured" : "needs-config",
    image_main: resolveImageStatus(artifacts.images),
    video_main: artifacts.videos[0]?.status || "pending",
    audio_main: artifacts.audio[0]?.status || "pending"
  };

  const posterPayload = buildPosterPayload(masterJson);

  await sleep(mode === "mock" ? 1400 : 200);

  return {
    mode,
    masterJson,
    posterPayload,
    diagnostics: buildProviderDiagnostics(config, providerRouteStatus)
  };
}
