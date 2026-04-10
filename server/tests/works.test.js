import assert from "node:assert/strict";

import { BASE_MEDIARK_CONFIG, mergeConfigOverrides } from "../../js/config/api-config.js";
import { apiRequest, createTestContext, loginAs } from "./test-helpers.js";

const ctx = await createTestContext({
  generationRuntime: {
    config: mergeConfigOverrides(BASE_MEDIARK_CONFIG, { mode: "mock" }),
    sleep: async () => {}
  }
});

try {
  const admin = await loginAs(ctx.baseUrl, "admin", "admin123");
  const doctor = await loginAs(ctx.baseUrl, "doctor", "doctor123");

  const createdDoctor = await apiRequest(ctx.baseUrl, "/api/users", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      username: "doctor2",
      displayName: "Doctor Two",
      role: "doctor",
      password: "doctor234"
    }
  });
  assert.equal(createdDoctor.response.status, 201);

  const doctorTwo = await loginAs(ctx.baseUrl, "doctor2", "doctor234");

  const adminWorks = await apiRequest(ctx.baseUrl, "/api/works", {
    cookie: admin.cookie
  });
  assert.equal(adminWorks.response.status, 403);

  const generated = await apiRequest(ctx.baseUrl, "/api/works/generate", {
    method: "POST",
    cookie: doctor.cookie,
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
          language: "zh-CN",
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
  assert.equal(generated.response.status, 202);
  assert.ok(generated.payload.taskId, "generate should return taskId");

  // Poll task until completion
  let taskPayload = null;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const pollRes = await apiRequest(ctx.baseUrl, `/api/works/generate/task/${generated.payload.taskId}`, {
      cookie: doctor.cookie
    });
    if (pollRes.payload?.status === "completed") {
      taskPayload = pollRes.payload;
      break;
    }
    if (pollRes.payload?.status === "failed") {
      throw new Error(`Generation failed: ${pollRes.payload.error}`);
    }
  }
  assert.ok(taskPayload, "task should complete within timeout");
  assert.ok(taskPayload.result?.work, "task should return work");

  // Replace generated with task result for subsequent assertions
  generated.payload = taskPayload.result;
  assert.equal(generated.payload.work.status, "generated");
  assert.equal(generated.payload.work.latestVersion.version, 1);

  const otherDoctorList = await apiRequest(ctx.baseUrl, "/api/works", {
    cookie: doctorTwo.cookie
  });
  assert.equal(otherDoctorList.response.status, 200);
  assert.equal(otherDoctorList.payload.items.length, 0);

  const otherDoctorDetail = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}`, {
    cookie: doctorTwo.cookie
  });
  assert.equal(otherDoctorDetail.response.status, 403);

  const regenerated = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/regenerate`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      input: {
        form: {
          doctorNotes: "Second pass: simplify the home monitoring section."
        }
      }
    }
  });
  assert.equal(regenerated.response.status, 200);
  assert.equal(regenerated.payload.work.status, "generated");
  assert.equal(regenerated.payload.work.latestVersion.version, 2);

  const blockedAdminPublish = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: admin.cookie
  });
  assert.equal(blockedAdminPublish.response.status, 403);

  const published = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/publish`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      note: "Final clinical wording confirmed for distribution."
    }
  });
  assert.equal(published.response.status, 200);
  assert.equal(published.payload.work.status, "published");

  const libraryAfterPublish = await apiRequest(ctx.baseUrl, "/api/library/works");
  assert.equal(libraryAfterPublish.response.status, 200);
  assert.ok(libraryAfterPublish.payload.items.some((item) => item.id === generated.payload.work.id));

  const archived = await apiRequest(ctx.baseUrl, `/api/works/${generated.payload.work.id}/archive`, {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      note: "Archived after demo review."
    }
  });
  assert.equal(archived.response.status, 200);
  assert.equal(archived.payload.work.status, "archived");

  const libraryAfterArchive = await apiRequest(ctx.baseUrl, "/api/library/works");
  assert.equal(libraryAfterArchive.response.status, 200);
  assert.ok(!libraryAfterArchive.payload.items.some((item) => item.id === generated.payload.work.id));

  console.log("works.test.js passed");
} finally {
  await ctx.close();
}
