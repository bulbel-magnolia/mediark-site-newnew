const BYTEPLUS_ARK_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

export const BASE_MEDIARK_CONFIG = {
  mode: "mock",
  providers: {
    text_master: {
      label: "Master JSON",
      provider: "openai-compatible",
      model: "gpt-5.4",
      baseUrl: "",
      apiKey: ""
    },
    text_reviewer: {
      label: "Clinical Reviewer",
      provider: "openai-compatible",
      model: "gpt-5.4",
      baseUrl: "",
      apiKey: ""
    },
    image_main: {
      label: "Poster / Visual Assets",
      provider: "byteplus-modelark",
      model: "bytedance-seedream-5.0-lite",
      preferredVersion: "260128",
      baseUrl: BYTEPLUS_ARK_BASE_URL,
      apiKey: "",
      apiStyle: "openai-images",
      notes: "Official BytePlus ModelArk image generation route for Seedream 5.0 Lite."
    },
    video_main: {
      label: "Short Clinical Video",
      provider: "byteplus-modelark",
      model: "seedance-1-5-pro-251215",
      targetProduct: "Seedance 2.0",
      baseUrl: BYTEPLUS_ARK_BASE_URL,
      apiKey: "",
      apiStyle: "byteplus-video-task",
      notes: "Official BytePlus API docs currently expose async video task APIs for Seedance 1.5 Pro. Seedance 2.0 is kept as the target product direction."
    },
    audio_main: {
      label: "Narration",
      provider: "openai-compatible",
      model: "tts-placeholder",
      baseUrl: "",
      apiKey: ""
    }
  }
};

function cloneConfig(value) {
  return structuredClone(value);
}

export function mergeConfigOverrides(baseConfig, overrides = {}) {
  const merged = cloneConfig(baseConfig);

  if (typeof overrides.mode === "string" && overrides.mode.trim()) {
    merged.mode = overrides.mode.trim();
  }

  const providerOverrides = overrides.providers || {};

  Object.entries(providerOverrides).forEach(([role, override]) => {
    const existing = merged.providers[role] || {};
    merged.providers[role] = {
      ...existing,
      ...override
    };
  });

  return merged;
}

async function loadLocalConfig() {
  try {
    const module = await import("./api-config.local.js");
    return module.MEDIARK_LOCAL_CONFIG || module.default || {};
  } catch (error) {
    const message = String(error?.message || "");
    const isMissingModule = error?.code === "ERR_MODULE_NOT_FOUND"
      || message.includes("Cannot find module")
      || message.includes("Failed to fetch dynamically imported module")
      || message.includes("error loading dynamically imported module");

    if (isMissingModule) {
      return {};
    }

    console.warn("Failed to load api-config.local.js", error);
    return {};
  }
}

const LOCAL_MEDIARK_CONFIG = await loadLocalConfig();

// Support environment variables for server deployment (Render, Railway, etc.)
// Falls back gracefully when process.env is unavailable (browser context)
function loadEnvConfig() {
  try {
    const env = typeof process !== "undefined" ? process.env : {};
    if (!env.MEDIARK_TEXT_API_KEY && !env.MEDIARK_IMAGE_API_KEY) {
      return {};
    }

    return {
      mode: env.MEDIARK_MODE || "live",
      providers: {
        ...(env.MEDIARK_TEXT_API_KEY ? {
          text_master: {
            baseUrl: env.MEDIARK_TEXT_BASE_URL || "",
            apiKey: env.MEDIARK_TEXT_API_KEY || "",
            model: env.MEDIARK_TEXT_MODEL || "gpt-4o"
          },
          text_reviewer: {
            baseUrl: env.MEDIARK_TEXT_BASE_URL || "",
            apiKey: env.MEDIARK_TEXT_API_KEY || "",
            model: env.MEDIARK_TEXT_MODEL || "gpt-4o"
          }
        } : {}),
        ...(env.MEDIARK_IMAGE_API_KEY ? {
          image_main: {
            baseUrl: env.MEDIARK_IMAGE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
            apiKey: env.MEDIARK_IMAGE_API_KEY || "",
            model: env.MEDIARK_IMAGE_MODEL || "doubao-seedream-5-0-260128"
          }
        } : {}),
        ...(env.MEDIARK_VIDEO_API_KEY ? {
          video_main: {
            baseUrl: env.MEDIARK_VIDEO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
            apiKey: env.MEDIARK_VIDEO_API_KEY || "",
            model: env.MEDIARK_VIDEO_MODEL || "doubao-seedance-1-5-pro-251215"
          }
        } : {})
      }
    };
  } catch {
    return {};
  }
}

const ENV_CONFIG = loadEnvConfig();

// Priority: local file > env vars > base defaults
export const MEDIARK_CONFIG = mergeConfigOverrides(
  mergeConfigOverrides(BASE_MEDIARK_CONFIG, ENV_CONFIG),
  LOCAL_MEDIARK_CONFIG
);

export function getProviderRegistry() {
  return cloneConfig(MEDIARK_CONFIG.providers);
}

export function hasLiveCredentials(role) {
  const provider = MEDIARK_CONFIG.providers[role];
  return Boolean(provider?.baseUrl && provider?.apiKey);
}
