import { all, fromJson } from "../db.js";

export function retrieveClinicalDefaults(db, { cancerType = "esophageal", categories = [], language = "zh-CN" } = {}) {
  if (!db || !categories.length) return null;

  const lang = String(language).toLowerCase().startsWith("en") ? "en" : "zh-CN";

  const mustDo = [];
  const mustAvoid = [];
  const redFlags = [];
  const faq = [];

  for (const category of categories) {
    const rows = all(
      db,
      "SELECT * FROM clinical_defaults WHERE cancer_type = :cancerType AND category = :category AND language = :lang",
      { cancerType, category, lang }
    );

    for (const row of rows) {
      mustDo.push(...fromJson(row.must_do_json, []));
      mustAvoid.push(...fromJson(row.must_avoid_json, []));
      redFlags.push(...fromJson(row.red_flags_json, []));
      faq.push(...fromJson(row.faq_json, []));
    }
  }

  const unique = (arr) => [...new Set(arr.filter(Boolean))];

  return {
    mustDo: unique(mustDo).slice(0, 6),
    mustAvoid: unique(mustAvoid).slice(0, 5),
    redFlags: unique(redFlags).slice(0, 5),
    faq: faq.slice(0, 3)
  };
}
