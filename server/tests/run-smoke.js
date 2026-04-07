import assert from "node:assert/strict";

import { BASE_MEDIARK_CONFIG, mergeConfigOverrides } from "../../js/config/api-config.js";
import { apiRequest, createTestContext, loginAs } from "./test-helpers.js";

const runtime = {
  config: mergeConfigOverrides(BASE_MEDIARK_CONFIG, { mode: "mock" }),
  sleep: async () => {}
};

const ctx = await createTestContext({ generationRuntime: runtime });

try {
  const admin = await loginAs(ctx.baseUrl, "admin", "admin123");
  const doctor = await loginAs(ctx.baseUrl, "doctor", "doctor123");

  const active = await apiRequest(ctx.baseUrl, "/api/schemas/clinical-education-prescription/active", {
    cookie: admin.cookie
  });
  assert.equal(active.response.status, 200);

  const generated = await apiRequest(ctx.baseUrl, "/api/works/generate", {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      schemaSlug: "clinical-education-prescription",
      input: {
        patient: {
          id: "smoke-1",
          name: "Smoke Patient",
          diagnosis: "Breast cancer recovery",
          stage: "Follow-up"
        },
        form: {
          focusTopics: ["red flags", "medication"],
          doctorNotes: "Use calm language.",
          videoDurationSec: 8
        },
        work: {
          title: "Smoke Workflow",
          topic: "Home monitoring",
          format: "poster-video",
          audience: "patient-family"
        }
      }
    }
  });
  assert.equal(generated.response.status, 201);

  const blockedAdminPublish = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: admin.cookie,
    body: {
      note: "Admin should not be allowed."
    }
  });
  assert.equal(blockedAdminPublish.response.status, 403);

  const regenerated = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/regenerate`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      input: {
        form: {
          doctorNotes: "Second pass for clearer family guidance."
        }
      }
    }
  });
  assert.equal(regenerated.payload.work.status, "generated");
  assert.equal(regenerated.payload.work.latestVersion.version, 2);

  const published = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      note: "Doctor confirmed this bundle for the public library."
    }
  });
  assert.equal(published.payload.work.status, "published");

  const library = await apiRequest(ctx.baseUrl, "/api/library/works");
  assert.ok(library.payload.items.some((item) => item.id === generated.payload.work.id));

  const archived = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/archive`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      note: "Archive after smoke verification."
    }
  });
  assert.equal(archived.payload.work.status, "archived");

  console.log("server smoke passed");
} finally {
  await ctx.close();
}
