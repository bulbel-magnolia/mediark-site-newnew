import express from "express";

import { generateWorkBundle } from "../lib/generate-work.js";
import {
  appendGeneratedWorkVersion,
  archiveWork,
  createGeneratedWork,
  getActiveSchemaVersion,
  getWorkById,
  listWorks,
  publishWork,
  reviewWork
} from "../lib/work-service.js";

export function createWorksRouter({ db, auth, generationRuntime = {} }) {
  const router = express.Router();

  router.use(auth.requireAuth, auth.requireRole("doctor"));

  function requireOwnedWork(req, res) {
    const work = getWorkById(db, Number(req.params.id));

    if (!work) {
      res.status(404).json({ error: "Work not found." });
      return null;
    }

    if (work.createdBy?.id !== req.auth.user.id) {
      res.status(403).json({ error: "You can only access works created by your own doctor account." });
      return null;
    }

    return work;
  }

  router.get("/", (req, res) => {
    res.json({
      items: listWorks(db, req.auth.user, {
        status: req.query.status ? String(req.query.status) : ""
      })
    });
  });

  router.get("/:id", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    return res.json({ work });
  });

  router.post("/generate", async (req, res) => {
    const schemaSlug = String(req.body?.schemaSlug || "clinical-education-prescription");
    const active = getActiveSchemaVersion(db, schemaSlug);

    if (!active) {
      return res.status(404).json({ error: "Active schema not found." });
    }

    const generated = await generateWorkBundle({
      input: req.body?.input || {},
      runtime: generationRuntime
    });

    const work = createGeneratedWork(db, {
      schema: active.schema,
      schemaVersion: active.version,
      input: generated.input,
      bundle: generated.bundle,
      workMeta: generated.workMeta,
      createdBy: req.auth.user.id
    });

    return res.status(201).json({ work });
  });

  router.post("/:id/regenerate", async (req, res) => {
    const existing = requireOwnedWork(req, res);
    if (!existing) return;
    const workId = existing.id;

    const active = getActiveSchemaVersion(db, existing.schema.slug);

    if (!active) {
      return res.status(404).json({ error: "Active schema not found." });
    }

    const nextInput = {
      ...(existing.latestVersion?.input || {}),
      ...(req.body?.input || {})
    };

    const generated = await generateWorkBundle({
      input: nextInput,
      runtime: generationRuntime
    });
    const work = appendGeneratedWorkVersion(db, {
      workId,
      schemaVersion: active.version,
      input: generated.input,
      bundle: generated.bundle,
      workMeta: generated.workMeta,
      createdBy: req.auth.user.id
    });

    return res.json({ work });
  });

  router.post("/:id/review", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    const action = String(req.body?.action || "");

    if (!["approve", "changes_requested"].includes(action)) {
      return res.status(400).json({ error: "Unsupported review action." });
    }

    return res.json({
      work: reviewWork(db, work.id, req.auth.user.id, action, String(req.body?.note || ""))
    });
  });

  router.post("/:id/publish", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    if (!["generated", "approved", "published", "archived"].includes(work.status)) {
      return res.status(400).json({ error: "Only generated or editable works can be confirmed to the library." });
    }

    return res.json({
      work: publishWork(db, work.id, req.auth.user.id, String(req.body?.note || ""))
    });
  });

  router.post("/:id/archive", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    return res.json({
      work: archiveWork(db, work.id, req.auth.user.id, String(req.body?.note || ""))
    });
  });

  return router;
}
