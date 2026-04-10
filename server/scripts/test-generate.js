// Direct generation tester — calls generateWorkBundle() with poster format
// Usage: node server/scripts/test-generate.js

import { createDatabase } from "../db.js";
import { seedDatabase } from "../seed.js";
import { generateWorkBundle } from "../lib/generate-work.js";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {
  // ignore if already loaded
}

const db = createDatabase();
seedDatabase(db);

console.log("Running generateWorkBundle with poster-text format...\n");

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

console.log(`normalized enabledFormats: ${JSON.stringify(result.input.enabledFormats)}`);
console.log(`image_spec.assets count: ${(master.spec.image_spec?.assets || []).length}`);
console.log(`image_spec.assets:`, JSON.stringify(master.spec.image_spec?.assets?.map(a => ({id: a.id, role: a.role})), null, 2));
console.log(`status.image_generation: ${master.status.image_generation}`);
console.log(`\nImage count: ${images.length}`);
for (const img of images) {
  console.log(`  id=${img.id} status=${img.status} path=${(img.path || "empty").slice(0, 100)}`);
  if (img.errorMessage) console.log(`    error: ${img.errorMessage}`);
}

console.log(`\nposter heroImage: ${(result.bundle.posterPayload.heroImage || "empty").slice(0, 100)}`);

db.close();
