import express from "express";

import { generateWorkBundle } from "../lib/generate-work.js";
import {
  appendGeneratedWorkVersion,
  archiveWork,
  createGeneratedWork,
  getActiveSchemaVersion,
  getUserById,
  getWorkById,
  listWorks,
  publishWork,
  reviewWork,
  submitWorkForReview
} from "../lib/work-service.js";

export function createWorksRouter({ db, auth, generationRuntime = {} }) {
  const router = express.Router();

  router.use(auth.requireAuth);

  router.get("/", (req, res) => {
    res.json({
      items: listWorks(db, req.auth.user, {
        status: req.query.status ? String(req.query.status) : ""
      })
    });
  });

  router.get("/:id", (req, res) => {
    const work = getWorkById(db, Number(req.params.id));

    if (!work) {
      return res.status(404).json({ error: "Work not found." });
    }

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
    const workId = Number(req.params.id);
    const existing = getWorkById(db, workId);

    if (!existing) {
      return res.status(404).json({ error: "Work not found." });
    }

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

  router.post("/:id/submit-review", auth.requireRole("admin"), (req, res) => {
    const workId = Number(req.params.id);
    const work = getWorkById(db, workId);

    if (!work) {
      return res.status(404).json({ error: "Work not found." });
    }

    const reviewerId = Number(req.body?.reviewerId);
    const reviewer = getUserById(db, reviewerId);

    if (!reviewer || reviewer.role !== "doctor-reviewer") {
      return res.status(400).json({ error: "A doctor reviewer must be assigned." });
    }

    const updated = submitWorkForReview(
      db,
      workId,
      reviewerId,
      String(req.body?.note || ""),
      req.auth.user.id
    );
    return res.json({ work: updated });
  });

  router.post("/:id/review", auth.requireRole("doctor-reviewer"), (req, res) => {
    const workId = Number(req.params.id);
    const work = getWorkById(db, workId);

    if (!work) {
      return res.status(404).json({ error: "Work not found." });
    }

    if (work.assignedReviewer && work.assignedReviewer.id !== req.auth.user.id) {
      return res.status(403).json({ error: "This work is assigned to another reviewer." });
    }

    const action = String(req.body?.action || "");

    if (!["approve", "changes_requested"].includes(action)) {
      return res.status(400).json({ error: "action must be approve or changes_requested." });
    }

    const updated = reviewWork(db, workId, req.auth.user.id, action, String(req.body?.note || ""));
    return res.json({ work: updated });
  });

  router.post("/:id/publish", auth.requireRole("admin"), (req, res) => {
    const workId = Number(req.params.id);
    const work = getWorkById(db, workId);

    if (!work) {
      return res.status(404).json({ error: "Work not found." });
    }

    if (work.status !== "approved") {
      return res.status(400).json({ error: "Only approved works can be published." });
    }

    return res.json({ work: publishWork(db, workId) });
  });

  router.post("/:id/archive", auth.requireRole("admin"), (req, res) => {
    const workId = Number(req.params.id);
    const work = getWorkById(db, workId);

    if (!work) {
      return res.status(404).json({ error: "Work not found." });
    }

    return res.json({ work: archiveWork(db, workId) });
  });

  return router;
}
