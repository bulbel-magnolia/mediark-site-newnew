// Direct generation tester — calls generateWorkBundle() with poster format
// Usage: node server/scripts/test-generate.js
// IMPORTANT: loads .env BEFORE importing any app modules

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", "..", ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
  console.log(`Loaded .env (${Object.keys(process.env).filter(k => k.startsWith("MEDIARK_")).length} MEDIARK_* vars)`);
  console.log(`Mode: ${process.env.MEDIARK_MODE}`);
}

// Now dynamic import with env already set
const { createDatabase } = await import("../db.js");
const { seedDatabase } = await import("../seed.js");
const { generateWorkBundle } = await import("../lib/generate-work.js");

const db = createDatabase();
seedDatabase(db);

console.log("\nRunning generateWorkBundle with poster-text format...\n");

const result = await generateWorkBundle({
  input: {
    patient: {
      id: "1",
      name: "test",
      diagnosis: "食管鳞状细胞癌",
      stage: "术后第1周",
      cancerType: "esophageal"
    },
    form: {
      language: "zh-CN",
      focusTopics: ["术后饮食"],
      doctorNotes: ""
    },
    work: { title: "test", format: "poster-text", audience: "patient" }
  },
  db
});

const master = result.bundle.masterJson;
const images = master.artifacts.images;

console.log(`bundle.mode: ${result.bundle.mode}`);
console.log(`normalized enabledFormats: ${JSON.stringify(result.input.enabledFormats)}`);
console.log(`image_spec.assets count: ${(master.spec.image_spec?.assets || []).length}`);
console.log(`status.image_generation: ${master.status.image_generation}`);
console.log(`\nImage count: ${images.length}`);
for (const img of images) {
  console.log(`  id=${img.id} status=${img.status} path=${(img.path || "empty").slice(0, 100)}`);
  if (img.errorMessage) console.log(`    error: ${img.errorMessage}`);
}

console.log(`\nposter heroImage: ${(result.bundle.posterPayload.heroImage || "empty").slice(0, 100)}`);

db.close();
