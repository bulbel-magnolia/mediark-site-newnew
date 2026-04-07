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
  const reviewer = await loginAs(ctx.baseUrl, "reviewer", "review123");

  const active = await apiRequest(ctx.baseUrl, "/api/schemas/clinical-education-prescription/active", {
    cookie: admin.cookie
  });
  assert.equal(active.response.status, 200);

  const generated = await apiRequest(ctx.baseUrl, "/api/works/generate", {
    method: "POST",
    cookie: admin.cookie,
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

  const submitted = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/submit-review`, {
    method: "POST",
    cookie: admin.cookie,
    body: {
      reviewerId: reviewer.payload.user.id,
      note: "Please verify clinical red flags."
    }
  });
  assert.equal(submitted.payload.work.status, "in_review");

  const blockedAdminApproval = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/review`, {
    method: "POST",
    cookie: admin.cookie,
    body: {
      action: "approve",
      note: "Admin should not be allowed."
    }
  });
  assert.equal(blockedAdminApproval.response.status, 403);

  const approved = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/review`, {
    method: "POST",
    cookie: reviewer.cookie,
    body: {
      action: "approve",
      note: "Clinically acceptable."
    }
  });
  assert.equal(approved.payload.work.status, "approved");

  const published = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: admin.cookie,
    body: {}
  });
  assert.equal(published.payload.work.status, "published");

  const library = await apiRequest(ctx.baseUrl, "/api/library/works");
  assert.ok(library.payload.items.some((item) => item.id === generated.payload.work.id));

  console.log("server smoke passed");
} finally {
  await ctx.close();
}
