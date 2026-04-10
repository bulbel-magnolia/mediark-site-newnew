// 诊断文本 → cancer_type 推断规则
// 当前系统数据仅覆盖食管癌（esophageal），其他条目是为未来多癌种扩展留的推断规则
// 未命中任何规则时返回 null，由调用方决定默认值或报错
const DIAGNOSIS_PATTERNS = [
  { pattern: /食管|esophag/i, cancerType: "esophageal" },
  { pattern: /肺癌|肺腺癌|肺鳞癌|lung\s*cancer|NSCLC|SCLC/i, cancerType: "lung" },
  { pattern: /胃癌|胃腺癌|gastric|stomach\s*cancer/i, cancerType: "gastric" },
  { pattern: /结直肠|结肠|直肠|colorectal|colon\s*cancer|rectal\s*cancer/i, cancerType: "colorectal" },
  { pattern: /肝癌|肝细胞癌|hepatocellular|HCC/i, cancerType: "liver" },
  { pattern: /胰腺|pancreatic/i, cancerType: "pancreatic" },
  { pattern: /乳腺|breast\s*cancer/i, cancerType: "breast" }
];

export function inferCancerType(diagnosis = "") {
  const text = String(diagnosis).trim();
  for (const { pattern, cancerType } of DIAGNOSIS_PATTERNS) {
    if (pattern.test(text)) return cancerType;
  }
  // 没命中时不硬编码默认值，返回 null，让调用方决定
  return null;
}

export function normalizeCancerType(cancerType) {
  const normalized = String(cancerType || "").trim().toLowerCase();
  return normalized || null;
}
