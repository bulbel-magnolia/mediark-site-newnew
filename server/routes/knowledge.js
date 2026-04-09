import express from "express";
import { all, get, run, fromJson, toJson, nowIso } from "../db.js";

export function createKnowledgeRouter({ db, auth }) {
  const router = express.Router();

  // 获取统计（按分类计数 + 按癌种计数）— 必须在 /:id 之前
  router.get("/stats/summary", (_req, res) => {
    const byCategory = all(db, "SELECT category, COUNT(*) as count FROM knowledge_entries GROUP BY category");
    const byCancerType = all(db, "SELECT cancer_type, COUNT(*) as count FROM knowledge_entries GROUP BY cancer_type");
    res.json({ byCategory, byCancerType, total: all(db, "SELECT COUNT(*) as count FROM knowledge_entries")[0]?.count || 0 });
  });

  // 公开端点：获取知识条目（供前端展示和 AI 生成时引用）
  router.get("/", (req, res) => {
    const conditions = [];
    const params = {};

    if (req.query.cancer_type) {
      conditions.push("cancer_type = :cancerType");
      params.cancerType = String(req.query.cancer_type);
    }
    if (req.query.category) {
      conditions.push("category = :category");
      params.category = String(req.query.category);
    }
    if (req.query.q) {
      conditions.push("(title LIKE :q OR summary LIKE :q OR title_en LIKE :q)");
      params.q = "%" + String(req.query.q) + "%";
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const rows = all(db, `SELECT * FROM knowledge_entries ${where} ORDER BY year DESC, id DESC`, params);

    res.json({
      items: rows.map(row => ({
        id: row.id,
        cancerType: row.cancer_type,
        category: row.category,
        title: row.title,
        titleEn: row.title_en,
        source: row.source,
        authors: row.authors,
        year: row.year,
        summary: row.summary,
        keyPoints: fromJson(row.key_points_json, []),
        evidenceLevel: row.evidence_level,
        url: row.url,
        tags: fromJson(row.tags_json, []),
        createdAt: row.created_at
      }))
    });
  });

  // 获取单条
  router.get("/:id", (req, res) => {
    const row = get(db, "SELECT * FROM knowledge_entries WHERE id = :id", { id: Number(req.params.id) });
    if (!row) return res.status(404).json({ error: "Entry not found." });

    res.json({
      entry: {
        id: row.id,
        cancerType: row.cancer_type,
        category: row.category,
        title: row.title,
        titleEn: row.title_en,
        source: row.source,
        authors: row.authors,
        year: row.year,
        summary: row.summary,
        keyPoints: fromJson(row.key_points_json, []),
        evidenceLevel: row.evidence_level,
        url: row.url,
        tags: fromJson(row.tags_json, [])
      }
    });
  });

  // 管理员：新增知识条目
  router.post("/", auth.requireAuth, auth.requireRole("admin"), (req, res) => {
    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "Title is required." });

    const result = run(db,
      `INSERT INTO knowledge_entries (cancer_type, category, title, title_en, source, authors, year, summary, key_points_json, evidence_level, url, tags_json)
       VALUES (:cancerType, :category, :title, :titleEn, :source, :authors, :year, :summary, :keyPointsJson, :evidenceLevel, :url, :tagsJson)`,
      {
        cancerType: String(req.body?.cancerType || "esophageal"),
        category: String(req.body?.category || "guideline"),
        title,
        titleEn: String(req.body?.titleEn || ""),
        source: String(req.body?.source || ""),
        authors: String(req.body?.authors || ""),
        year: req.body?.year ? Number(req.body.year) : null,
        summary: String(req.body?.summary || ""),
        keyPointsJson: toJson(Array.isArray(req.body?.keyPoints) ? req.body.keyPoints : []),
        evidenceLevel: req.body?.evidenceLevel || null,
        url: String(req.body?.url || ""),
        tagsJson: toJson(Array.isArray(req.body?.tags) ? req.body.tags : [])
      }
    );

    res.status(201).json({ entry: { id: Number(result.lastInsertRowid), title } });
  });

  return router;
}
