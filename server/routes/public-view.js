import express from "express";

import { all, fromJson, get, run } from "../db.js";

export function createPublicViewRouter({ db }) {
  const router = express.Router();

  // GET /api/public/view/:token — 获取公开作品内容（无需登录）
  router.get("/:token", (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Missing token." });
    }

    const work = get(
      db,
      `SELECT w.*, u.display_name AS doctor_name
         FROM works w
         JOIN users u ON u.id = w.created_by
        WHERE w.view_token = :token AND w.status = 'published'`,
      { token }
    );

    if (!work) {
      return res.status(404).json({ error: "作品未找到或已下线" });
    }

    const version = get(
      db,
      `SELECT * FROM work_versions
        WHERE work_id = :workId
        ORDER BY version DESC
        LIMIT 1`,
      { workId: work.id }
    );

    if (!version) {
      return res.status(404).json({ error: "作品版本数据缺失" });
    }

    const masterJson = fromJson(version.master_json, {});
    const posterPayload = fromJson(version.poster_payload_json, null);
    const input = fromJson(version.input_json, {});

    const assets = all(
      db,
      `SELECT asset_key, asset_type, url, thumbnail_url, payload_json
         FROM assets
        WHERE work_version_id = :versionId`,
      { versionId: version.id }
    ).map((a) => ({
      key: a.asset_key,
      type: a.asset_type,
      url: a.url,
      thumbnailUrl: a.thumbnail_url,
      payload: fromJson(a.payload_json, {})
    }));

    // 静默增加访问计数
    run(db, "UPDATE works SET view_count = view_count + 1 WHERE id = :id", { id: work.id });

    return res.json({
      id: work.id,
      title: work.title,
      topic: work.topic,
      publishedAt: work.published_at,
      viewCount: (work.view_count || 0) + 1,
      doctorName: work.doctor_name || "",
      patient: {
        name: input?.patient?.name || "",
        diagnosis: input?.patient?.diagnosis || "",
        stage: input?.patient?.stage || ""
      },
      clinicalCore: masterJson?.spec?.clinical_core || {},
      copyMaster: masterJson?.spec?.copy_master || {},
      posterPayload,
      assets
    });
  });

  // POST /api/public/view/:token/feedback — 患者端提交反馈（无需登录）
  router.post("/:token/feedback", (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "Missing token." });

    const work = get(db, "SELECT id FROM works WHERE view_token = :token AND status IN ('published', 'archived')", { token });
    if (!work) return res.status(404).json({ error: "作品未找到或已下线" });

    const type = String(req.body?.type || "").trim();
    if (!["understood", "question", "helpful"].includes(type)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }

    const message = String(req.body?.message || "").trim().slice(0, 500);

    run(
      db,
      "INSERT INTO patient_feedback (work_id, feedback_type, message) VALUES (:workId, :type, :message)",
      { workId: work.id, type, message }
    );

    return res.status(201).json({ ok: true });
  });

  return router;
}
