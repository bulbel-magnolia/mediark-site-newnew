import express from "express";

import { all, get, run, nowIso, toJson, fromJson } from "../db.js";

export function createPatientsRouter({ db, auth }) {
  const router = express.Router();

  router.use(auth.requireAuth, auth.requireRole("doctor"));

  // List patients for the current doctor
  router.get("/", (req, res) => {
    const rows = all(
      db,
      `SELECT * FROM patients WHERE created_by = :userId ORDER BY updated_at DESC`,
      { userId: req.auth.user.id }
    );

    res.json({
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        diagnosis: row.diagnosis,
        stage: row.stage,
        tags: fromJson(row.tags_json, []),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  });

  // Get single patient
  router.get("/:id", (req, res) => {
    const row = get(
      db,
      `SELECT * FROM patients WHERE id = :id AND created_by = :userId`,
      { id: Number(req.params.id), userId: req.auth.user.id }
    );

    if (!row) {
      return res.status(404).json({ error: "Patient not found." });
    }

    return res.json({
      patient: {
        id: row.id,
        name: row.name,
        diagnosis: row.diagnosis,
        stage: row.stage,
        tags: fromJson(row.tags_json, []),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  });

  // Create patient
  router.post("/", (req, res) => {
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Patient name is required." });
    }

    const result = run(
      db,
      `INSERT INTO patients (name, diagnosis, stage, tags_json, notes, created_by)
       VALUES (:name, :diagnosis, :stage, :tagsJson, :notes, :createdBy)`,
      {
        name,
        diagnosis: String(req.body?.diagnosis || "").trim(),
        stage: String(req.body?.stage || "").trim(),
        tagsJson: toJson(Array.isArray(req.body?.tags) ? req.body.tags : []),
        notes: String(req.body?.notes || "").trim(),
        createdBy: req.auth.user.id
      }
    );

    const id = Number(result.lastInsertRowid);
    return res.status(201).json({ patient: { id, name } });
  });

  // Update patient
  router.patch("/:id", (req, res) => {
    const row = get(
      db,
      `SELECT id FROM patients WHERE id = :id AND created_by = :userId`,
      { id: Number(req.params.id), userId: req.auth.user.id }
    );

    if (!row) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const updates = [];
    const params = { id: row.id, updatedAt: nowIso() };

    if (req.body?.name !== undefined) { updates.push("name = :name"); params.name = String(req.body.name).trim(); }
    if (req.body?.diagnosis !== undefined) { updates.push("diagnosis = :diagnosis"); params.diagnosis = String(req.body.diagnosis).trim(); }
    if (req.body?.stage !== undefined) { updates.push("stage = :stage"); params.stage = String(req.body.stage).trim(); }
    if (req.body?.tags !== undefined) { updates.push("tags_json = :tagsJson"); params.tagsJson = toJson(Array.isArray(req.body.tags) ? req.body.tags : []); }
    if (req.body?.notes !== undefined) { updates.push("notes = :notes"); params.notes = String(req.body.notes).trim(); }

    if (updates.length) {
      updates.push("updated_at = :updatedAt");
      run(db, `UPDATE patients SET ${updates.join(", ")} WHERE id = :id`, params);
    }

    return res.json({ ok: true });
  });

  return router;
}
