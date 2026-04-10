import express from "express";

import { all, fromJson } from "../db.js";

export function createTemplatesRouter({ db, auth }) {
  const router = express.Router();

  router.use(auth.requireAuth, auth.requireRole("doctor"));

  // GET /api/templates?cancerType=esophageal — 列出指定癌种的作品模板
  router.get("/", (req, res) => {
    const cancerType = String(req.query.cancerType || "esophageal");
    const rows = all(
      db,
      `SELECT id, name, description, focus_topics_json, doctor_notes_template, suggested_formats
         FROM work_templates
        WHERE cancer_type = :cancerType AND is_active = 1
        ORDER BY sort_order, id`,
      { cancerType }
    );

    return res.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        focusTopics: fromJson(r.focus_topics_json, []),
        doctorNotesTemplate: r.doctor_notes_template,
        suggestedFormats: r.suggested_formats
      }))
    });
  });

  return router;
}
