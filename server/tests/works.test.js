import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest, createTestContext, loginAs } from "./test-helpers.js";

test("work lifecycle enforces reviewer approval before publish", async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const admin = await loginAs(ctx.baseUrl, "admin", "admin123");
  const reviewer = await loginAs(ctx.baseUrl, "reviewer", "review123");

  const generated = await apiRequest(ctx.baseUrl, "/api/works/generate", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      schemaSlug: "clinical-education-prescription",
      input: {
        patient: {
          id: "case-1001",
          name: "Lin Mei",
          diagnosis: "Breast cancer recovery",
          stage: "Adjuvant therapy"
        },
        form: {
          focusTopics: ["red flags", "medication"],
          doctorNotes: "Keep tone calm and clinically cautious.",
          videoDurationSec: 8
        },
        work: {
          title: "Post-treatment home education",
          topic: "Recovery monitoring",
          format: "poster-video",
          audience: "patient-family"
        }
      }
    }
  });
  assert.equal(generated.response.status, 201);
  assert.equal(generated.payload.work.status, "generated");
  assert.equal(generated.payload.work.latestVersion.version, 1);
  assert.ok(generated.payload.work.latestVersion.masterJson);

  const forbiddenApproval = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/review`, {
    method: "POST",
    cookie: admin.cookie,
    body: { action: "approve", note: "Admin cannot do clinical approval" }
  });
  assert.equal(forbiddenApproval.response.status, 403);

  const submitted = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/submit-review`, {
    method: "POST",
    cookie: admin.cookie,
    body: { reviewerId: reviewer.payload.user.id, note: "Please verify red flags and family guidance." }
  });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.payload.work.status, "in_review");

  const approved = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/review`, {
    method: "POST",
    cookie: reviewer.cookie,
    body: { action: "approve", note: "Clinical messaging is acceptable." }
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.work.status, "approved");

  const published = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: admin.cookie
  });
  assert.equal(published.response.status, 200);
  assert.equal(published.payload.work.status, "published");

  const library = await apiRequest(ctx.baseUrl, "/api/library/works");
  assert.equal(library.response.status, 200);
  assert.ok(library.payload.items.some((item) => item.id === generated.payload.work.id));
});
