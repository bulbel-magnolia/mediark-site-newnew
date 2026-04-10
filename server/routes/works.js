import express from "express";

import { run } from "../db.js";
import { generateWorkBundle } from "../lib/generate-work.js";
import { createTask, getTask, updateTask } from "../lib/task-manager.js";
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
        status: req.query.status ? String(req.query.status) : "",
        role: req.query.role ? String(req.query.role) : ""
      })
    });
  });

  // Submit work for expert review — assigns first available reviewer
  router.post("/:id/submit-review", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    // Find a reviewer (any doctor user that is not the creator)
    const reviewer = db.prepare(
      `SELECT id, display_name FROM users WHERE role = 'doctor' AND id != :creatorId AND is_active = 1 LIMIT 1`
    ).get({ creatorId: req.auth.user.id });

    if (!reviewer) {
      return res.status(400).json({ error: "No available reviewer found." });
    }

    run(db,
      `UPDATE works SET status = 'pending_review', assigned_reviewer_id = :reviewerId, updated_at = :now WHERE id = :id`,
      { reviewerId: reviewer.id, now: new Date().toISOString(), id: work.id }
    );

    // Record review action
    const latestVersion = db.prepare(
      `SELECT id FROM work_versions WHERE work_id = :workId ORDER BY version DESC LIMIT 1`
    ).get({ workId: work.id });

    run(db,
      `INSERT INTO review_actions (work_id, work_version_id, reviewer_id, action, note)
       VALUES (:workId, :versionId, :reviewerId, 'submitted_for_review', :note)`,
      {
        workId: work.id,
        versionId: latestVersion?.id || null,
        reviewerId: req.auth.user.id,
        note: `提交给 ${reviewer.display_name} 审核`
      }
    );

    return res.json({ ok: true, reviewer: { id: reviewer.id, displayName: reviewer.display_name } });
  });

  router.get("/:id", (req, res) => {
    // Allow both owner and assigned reviewer to view
    const work = getWorkById(db, Number(req.params.id));
    if (!work) return res.status(404).json({ error: "Work not found." });
    const isOwner = work.createdBy?.id === req.auth.user.id;
    const isReviewer = work.assignedReviewer?.id === req.auth.user.id;
    if (!isOwner && !isReviewer) return res.status(403).json({ error: "Access denied." });
    if (!work) return;

    return res.json({ work });
  });

  // 异步生成：立即返回 taskId，后台跑生成，前端轮询状态
  router.post("/generate", async (req, res) => {
    const schemaSlug = String(req.body?.schemaSlug || "clinical-education-prescription");
    const active = getActiveSchemaVersion(db, schemaSlug);

    if (!active) {
      return res.status(404).json({ error: "Active schema not found." });
    }

    const task = createTask();
    const userId = req.auth.user.id;
    const input = req.body?.input || {};

    console.log(`[generate] task=${task.id} created, format=${input?.work?.format || "?"}`);
    res.status(202).json({ taskId: task.id });

    // 后台异步执行（不阻塞响应）
    (async () => {
      const t0 = Date.now();
      try {
        updateTask(task.id, { status: "running", progress: "正在调用 AI 模型..." });

        const generated = await generateWorkBundle({
          input,
          runtime: generationRuntime,
          db
        });
        console.log(`[generate] task=${task.id} bundle built in ${Date.now() - t0}ms, images=${generated.bundle.masterJson.artifacts.images.length}`);

        updateTask(task.id, { progress: "正在保存作品..." });

        const work = createGeneratedWork(db, {
          schema: active.schema,
          schemaVersion: active.version,
          input: generated.input,
          bundle: generated.bundle,
          workMeta: generated.workMeta,
          createdBy: userId
        });
        console.log(`[generate] task=${task.id} work saved workId=${work.id}, total ${Date.now() - t0}ms`);

        updateTask(task.id, { status: "completed", progress: "完成", result: { work } });
      } catch (err) {
        console.error(`[generate] task=${task.id} ERROR after ${Date.now() - t0}ms:`, err?.stack || err);
        updateTask(task.id, { status: "failed", error: String(err?.message || err) });
      }
    })();
  });

  // 查询异步生成任务状态
  router.get("/generate/task/:taskId", (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found or expired." });
    }
    return res.json({
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error,
      result: task.status === "completed" ? task.result : null
    });
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
      runtime: generationRuntime,
      db
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
    const work = getWorkById(db, Number(req.params.id));
    if (!work) return res.status(404).json({ error: "Work not found." });
    const isOwner = work.createdBy?.id === req.auth.user.id;
    const isReviewer = work.assignedReviewer?.id === req.auth.user.id;
    if (!isOwner && !isReviewer) return res.status(403).json({ error: "Access denied." });

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

  // 医生端查看患者反馈列表
  router.get("/:id/feedback", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    const rows = db.prepare(
      `SELECT id, feedback_type, message, read_at, created_at
         FROM patient_feedback
        WHERE work_id = :workId
        ORDER BY created_at DESC`
    ).all({ workId: work.id });

    return res.json({
      items: rows.map((r) => ({
        id: r.id,
        type: r.feedback_type,
        message: r.message,
        readAt: r.read_at,
        createdAt: r.created_at
      }))
    });
  });

  // 把某作品的所有未读反馈标记为已读
  router.post("/:id/feedback/read", (req, res) => {
    const work = requireOwnedWork(req, res);
    if (!work) return;

    run(
      db,
      "UPDATE patient_feedback SET read_at = :readAt WHERE work_id = :workId AND read_at IS NULL",
      { workId: work.id, readAt: new Date().toISOString() }
    );

    return res.json({ ok: true });
  });

  // 批量归档（作品库删除使用）
  router.post("/bulk-archive", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) {
      return res.status(400).json({ error: "ids required" });
    }

    const archived = [];
    const skipped = [];
    const userId = req.auth.user.id;
    const isAdmin = req.auth.user.role === "admin";

    for (const id of ids) {
      const work = getWorkById(db, id);
      if (!work) {
        skipped.push({ id, reason: "not_found" });
        continue;
      }
      if (!isAdmin && work.createdBy?.id !== userId) {
        skipped.push({ id, reason: "not_owner" });
        continue;
      }
      try {
        archiveWork(db, id, userId, "Bulk archive from library");
        archived.push(id);
      } catch (err) {
        skipped.push({ id, reason: String(err?.message || err) });
      }
    }

    return res.json({ archived, skipped });
  });

  // Poll video task status from provider (proxied to avoid CORS)
  router.get("/video-status/:taskId", async (req, res) => {
    try {
      const { MEDIARK_CONFIG } = await import("../../js/config/api-config.js");
      const provider = MEDIARK_CONFIG.providers.video_main;

      if (!provider?.baseUrl || !provider?.apiKey) {
        return res.status(400).json({ error: "Video provider not configured." });
      }

      const taskId = String(req.params.taskId).trim();
      const pollRes = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/contents/generations/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` }
      });

      if (!pollRes.ok) {
        return res.status(pollRes.status).json({ error: "Provider returned error.", status: "failed" });
      }

      const data = await pollRes.json();
      const status = String(data.status || data.state || "").toLowerCase();
      const videoUrl = data.content?.video_url || "";

      return res.json({ status, videoUrl, taskId });
    } catch (err) {
      return res.status(500).json({ error: err.message, status: "error" });
    }
  });

  return router;
}
