import assert from "node:assert/strict";

import {
  BASE_MEDIARK_CONFIG,
  MEDIARK_CONFIG,
  getProviderRegistry,
  hasLiveCredentials,
  mergeConfigOverrides
} from "../../js/config/api-config.js";

assert.equal(BASE_MEDIARK_CONFIG.providers.text_master.baseUrl, "");
assert.equal(BASE_MEDIARK_CONFIG.providers.text_master.model, "gpt-5.4");
assert.equal(BASE_MEDIARK_CONFIG.providers.text_master.apiKey, "");
assert.equal(BASE_MEDIARK_CONFIG.providers.image_main.provider, "byteplus-modelark");
assert.equal(BASE_MEDIARK_CONFIG.providers.image_main.model, "bytedance-seedream-5.0-lite");
assert.equal(BASE_MEDIARK_CONFIG.providers.image_main.baseUrl, "https://ark.ap-southeast.bytepluses.com/api/v3");
assert.equal(BASE_MEDIARK_CONFIG.providers.video_main.model, "seedance-1-5-pro-251215");
assert.equal(hasLiveCredentials("text_master"), Boolean(MEDIARK_CONFIG.providers.text_master.apiKey));

const registry = getProviderRegistry();
registry.text_master.model = "mutated";
assert.equal(MEDIARK_CONFIG.providers.text_master.model, "gpt-5.4");

const merged = mergeConfigOverrides(MEDIARK_CONFIG, {
  providers: {
    text_master: {
      apiKey: "test-key"
    },
    image_main: {
      model: "bytedance-seedream-4.5"
    }
  }
});

assert.equal(merged.providers.text_master.apiKey, "test-key");
assert.equal(merged.providers.text_master.baseUrl, MEDIARK_CONFIG.providers.text_master.baseUrl);
assert.equal(merged.providers.image_main.model, "bytedance-seedream-4.5");
assert.equal(merged.providers.image_main.baseUrl, MEDIARK_CONFIG.providers.image_main.baseUrl);

console.log("api-config.test.js passed");
