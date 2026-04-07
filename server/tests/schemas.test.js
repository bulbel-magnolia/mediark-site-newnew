import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest, createTestContext, defaultSchemaDefinition, loginAs } from "./test-helpers.js";

test("admin can create schema versions and activate a version", async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const admin = await loginAs(ctx.baseUrl, "admin", "admin123");

  const existing = await apiRequest(ctx.baseUrl, "/api/schemas", {
    cookie: admin.cookie
  });
  assert.equal(existing.response.status, 200);
  assert.ok(existing.payload.items.some((item) => item.slug === "clinical-education-prescription"));

  const activeDefault = await apiRequest(ctx.baseUrl, "/api/schemas/clinical-education-prescription/active", {
    cookie: admin.cookie
  });
  assert.equal(activeDefault.response.status, 200);
  assert.equal(activeDefault.payload.schema.slug, "clinical-education-prescription");
  assert.ok(activeDefault.payload.version.definition.form_sections.length > 0);

  const created = await apiRequest(ctx.baseUrl, "/api/schemas", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      slug: "education-demo",
      name: "Education Demo",
      description: "Custom schema for contest demos",
      definition: defaultSchemaDefinition
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.schema.slug, "education-demo");

  const nextVersion = await apiRequest(ctx.baseUrl, `/api/schemas/${created.payload.schema.id}/versions`, {
    method: "POST",
    cookie: admin.cookie,
    body: {
      title: "v2",
      definition: {
        ...defaultSchemaDefinition,
        form_sections: [
          ...defaultSchemaDefinition.form_sections,
          {
            id: "editorial",
            title: "Editorial",
            fields: [
              { id: "tone_hint", label: "Tone Hint", type: "text", bind: "form.toneHint" }
            ]
          }
        ]
      }
    }
  });
  assert.equal(nextVersion.response.status, 201);
  assert.equal(nextVersion.payload.version.version, 2);

  const activated = await apiRequest(ctx.baseUrl, `/api/schemas/${created.payload.schema.id}/activate`, {
    method: "POST",
    cookie: admin.cookie,
    body: { versionId: nextVersion.payload.version.id }
  });
  assert.equal(activated.response.status, 200);

  const activeNewSchema = await apiRequest(ctx.baseUrl, "/api/schemas/education-demo/active", {
    cookie: admin.cookie
  });
  assert.equal(activeNewSchema.response.status, 200);
  assert.equal(activeNewSchema.payload.version.version, 2);
  assert.equal(activeNewSchema.payload.version.definition.form_sections.at(-1).id, "editorial");
});
