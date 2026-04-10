// Direct Seedream API tester — iterates through parameter combinations
// Usage: node server/scripts/test-seedream.js
// Reads API key from .env

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");

// Load .env
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const apiKey = process.env.MEDIARK_IMAGE_API_KEY;
const baseUrl = process.env.MEDIARK_IMAGE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const model = process.env.MEDIARK_IMAGE_MODEL || "doubao-seedream-5-0-260128";

if (!apiKey || apiKey.includes("你的")) {
  console.error("ERROR: MEDIARK_IMAGE_API_KEY not set in .env");
  process.exit(1);
}

console.log(`Base URL: ${baseUrl}`);
console.log(`Model: ${model}`);
console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
console.log("");

const testConfigs = [
  { name: "2k keyword lowercase", size: "2k" },
  { name: "3k keyword lowercase", size: "3k" },
  { name: "2688x1536 (16:9 4.1M)", size: "2688x1536" },
  { name: "2048x2048 (1:1 4.2M)", size: "2048x2048" },
  { name: "1920x2400 (4:5 4.6M)", size: "1920x2400" },
];

async function testConfig(config) {
  const body = {
    model,
    prompt: "A calm clinical education scene, a doctor gently explaining recovery to a patient, warm lighting, soft colors, no text overlay",
    size: config.size,
    response_format: "url",
    watermark: false
  };

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (res.ok && data.data?.[0]?.url) {
      console.log(`✅ [${config.name}] SUCCESS`);
      console.log(`   URL: ${data.data[0].url.slice(0, 100)}`);
      console.log(`   Actual size: ${data.data[0].size || "unknown"}`);
      return true;
    } else {
      console.log(`❌ [${config.name}] FAILED (${res.status})`);
      console.log(`   ${JSON.stringify(data).slice(0, 300)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ [${config.name}] ERROR: ${err.message}`);
    return false;
  }
}

(async () => {
  console.log("Testing Seedream API configurations...\n");
  const results = [];
  for (const config of testConfigs) {
    const ok = await testConfig(config);
    results.push({ ...config, ok });
    console.log("");
  }

  console.log("=== Summary ===");
  const working = results.filter((r) => r.ok);
  if (working.length) {
    console.log(`Working configs (${working.length}/${results.length}):`);
    working.forEach((r) => console.log(`  ✓ ${r.name} → size="${r.size}"`));
  } else {
    console.log("❌ No working configurations found!");
  }
})();
