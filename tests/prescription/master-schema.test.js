import assert from "node:assert/strict";

import { buildMasterJson, POSTER_LIMITS } from "../../js/prescription/master-schema.js";

const patient = {
  id: "20250801",
  name: "张建国",
  diagnosis: "食管癌术后恢复期",
  stage: "术后一周",
  tags: ["高焦虑", "低健康素养"],
  compliance: 85
};

const formInput = {
  language: "zh-CN",
  focusTopics: ["术后饮食", "吞咽训练", "危险信号"],
  doctorNotes: "请使用温和、清晰、可执行的语气，优先强调危险信号。"
};

const evidence = [
  {
    id: "E1",
    title: "术后饮食指导",
    source: "团队指南摘录",
    claim: "少量多餐，避免过热过硬。"
  },
  {
    id: "E2",
    title: "危险信号识别",
    source: "团队审核内容",
    claim: "持续呕吐、剧烈胸痛、完全无法进食需及时就医。"
  }
];

const masterJson = buildMasterJson({ patient, formInput, evidence });

assert.equal(masterJson.meta.language, "zh-CN");
assert.equal(masterJson.meta.case_id, "case-20250801");
assert.equal(masterJson.status.text_master, "ready");
assert.equal(masterJson.spec.patient_context.diagnosis, "食管癌术后恢复期");
assert.deepEqual(masterJson.spec.patient_context.focus_topics, ["术后饮食", "吞咽训练", "危险信号"]);
assert.equal(masterJson.spec.evidence_bundle.length, 2);
assert.equal(masterJson.review.doctor_review_required, true);
assert.ok(masterJson.spec.poster_spec.title.length <= POSTER_LIMITS.title);
assert.ok(masterJson.spec.poster_spec.subtitle.length <= POSTER_LIMITS.subtitle);
masterJson.spec.poster_spec.key_points.forEach((item) => {
  assert.ok(item.length <= POSTER_LIMITS.keyPoint);
});

console.log("master-schema.test.js passed");
