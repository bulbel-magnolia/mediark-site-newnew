import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { createApp } from "../app.js";
import { createDatabase } from "../db.js";
import { seedDatabase } from "../seed.js";

export async function createTestContext(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "mediark-server-"));
  const dbPath = path.join(root, "test.sqlite");
  const db = createDatabase({ filename: dbPath });
  seedDatabase(db);

  const app = createApp({
    db,
    disableStatic: true,
    generationRuntime: options.generationRuntime || {}
  });
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    db,
    baseUrl,
    async close() {
      server.close();
      await once(server, "close");
      db.close();
      await rm(root, { recursive: true, force: true });
    }
  };
}

export async function apiRequest(baseUrl, pathname, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    response,
    payload,
    cookie: response.headers.getSetCookie().map((entry) => entry.split(";", 1)[0]).join("; ")
  };
}

export async function loginAs(baseUrl, username, password) {
  const result = await apiRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { username, password }
  });

  assert.equal(result.response.status, 200, `login failed for ${username}`);
  assert.ok(result.cookie, `missing session cookie for ${username}`);
  return result;
}

export const defaultSchemaDefinition = {
  form_sections: [
    {
      id: "patient",
      title: "Patient",
      fields: [
        { id: "patient_name", label: "Patient Name", type: "text", bind: "patient.name", required: true },
        { id: "patient_diagnosis", label: "Diagnosis", type: "text", bind: "patient.diagnosis", required: true },
        { id: "patient_stage", label: "Stage", type: "text", bind: "patient.stage" }
      ]
    },
    {
      id: "campaign",
      title: "Campaign",
      fields: [
        {
          id: "focus_topics",
          label: "Focus Topics",
          type: "multiselect",
          bind: "form.focusTopics",
          options: ["medication", "red flags", "family support"],
          required: true
        },
        { id: "doctor_notes", label: "Doctor Notes", type: "textarea", bind: "form.doctorNotes" },
        { id: "video_duration", label: "Video Duration", type: "number", bind: "form.videoDurationSec" },
        { id: "work_title", label: "Title", type: "text", bind: "work.title", required: true },
        { id: "work_topic", label: "Topic", type: "text", bind: "work.topic" },
        { id: "work_format", label: "Format", type: "text", bind: "work.format" },
        { id: "work_audience", label: "Audience", type: "text", bind: "work.audience" }
      ]
    }
  ]
};
