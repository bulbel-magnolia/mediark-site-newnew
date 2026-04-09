const DIAGNOSIS_PATTERNS = [
  { pattern: /食管|esophag/i, cancerType: "esophageal" },
  { pattern: /肺癌|lung/i, cancerType: "lung" },
  { pattern: /胃癌|gastric/i, cancerType: "gastric" },
];

const KNOWN_TYPES = new Set(DIAGNOSIS_PATTERNS.map((p) => p.cancerType));

export function inferCancerType(diagnosis = "") {
  const text = String(diagnosis).trim();
  for (const { pattern, cancerType } of DIAGNOSIS_PATTERNS) {
    if (pattern.test(text)) return cancerType;
  }
  return "esophageal";
}

export function normalizeCancerType(cancerType) {
  const normalized = String(cancerType || "").trim().toLowerCase();
  return KNOWN_TYPES.has(normalized) ? normalized : "esophageal";
}
