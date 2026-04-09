import { all, fromJson } from "../db.js";

const TOPIC_CATEGORY_MAP = {
  "饮食": "nutrition",
  "营养": "nutrition",
  "术后饮食": "nutrition",
  "肠内营养": "nutrition",
  "吞咽": "rehabilitation",
  "吞咽训练": "rehabilitation",
  "康复": "rehabilitation",
  "康复训练": "rehabilitation",
  "心理": "rehabilitation",
  "心理支持": "rehabilitation",
  "焦虑": "rehabilitation",
  "并发症": "rehabilitation",
  "危险信号": "rehabilitation",
  "红旗症状": "rehabilitation",
  "化疗": "regimen",
  "方案": "regimen",
  "治疗方案": "regimen",
  "分期": "staging",
  "TNM": "staging",
  "指南": "guideline",
  "随访": "guideline",
  "监测": "guideline",
  "放疗": "guideline",
  "食管炎": "guideline"
};

function hydrateRow(row) {
  return {
    id: `KB-${row.id}`,
    title: row.title,
    source: row.source,
    authors: row.authors || "",
    year: row.year,
    summary: row.summary,
    key_points: fromJson(row.key_points_json, []),
    evidence_level: row.evidence_level || "",
    category: row.category
  };
}

export function retrieveEvidenceForTopics(db, { focusTopics = [], cancerType = "esophageal", limit = 8 } = {}) {
  if (!db || !focusTopics.length) return { entries: [], matchedCategories: [] };

  const seen = new Set();
  const results = [];
  const matchedCategories = new Set();

  for (const topic of focusTopics) {
    if (!topic || typeof topic !== "string") continue;
    const trimmed = topic.trim();
    if (!trimmed) continue;

    // Layer 1: tag match
    const tagRows = all(db,
      "SELECT * FROM knowledge_entries WHERE cancer_type = :cancerType AND tags_json LIKE :pattern",
      { cancerType, pattern: `%${trimmed}%` }
    );
    for (const row of tagRows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push(hydrateRow(row));
        matchedCategories.add(row.category);
      }
    }

    // Layer 2: category mapping
    const category = TOPIC_CATEGORY_MAP[trimmed];
    if (category) {
      matchedCategories.add(category);
      const catRows = all(db,
        "SELECT * FROM knowledge_entries WHERE cancer_type = :cancerType AND category = :category",
        { cancerType, category }
      );
      for (const row of catRows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          results.push(hydrateRow(row));
          matchedCategories.add(row.category);
        }
      }
    }

    // Layer 3: title/summary full-text search
    const textRows = all(db,
      "SELECT * FROM knowledge_entries WHERE cancer_type = :cancerType AND (title LIKE :q OR summary LIKE :q)",
      { cancerType, q: `%${trimmed}%` }
    );
    for (const row of textRows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push(hydrateRow(row));
        matchedCategories.add(row.category);
      }
    }
  }

  return { entries: results.slice(0, limit), matchedCategories: [...matchedCategories] };
}
