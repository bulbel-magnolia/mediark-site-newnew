import assert from "node:assert/strict";

import { buildPosterPayload } from "../../js/prescription/poster-renderer.js";

const masterJson = {
  spec: {
    poster_spec: {
      template_id: "poster_clinical_v1",
      title: "术后一周饮食提醒",
      subtitle: "食管癌术后恢复期患者宣教",
      key_points: ["少量多餐", "温软流食", "及时识别危险信号"],
      do_list: ["慢慢进食", "按时训练", "观察不适"],
      dont_list: ["吃硬食", "吃太快", "忽视疼痛"],
      red_flags: ["持续呕吐", "剧烈胸痛", "完全无法进食"],
      footer_badge: "医生确认后发放",
      source_tag: "团队证据包支持"
    }
  },
  artifacts: {
    images: [
      {
        id: "hero_image",
        role: "poster_hero",
        path: "网页展示素材库/solution.jpg"
      }
    ]
  }
};

const payload = buildPosterPayload(masterJson);

assert.equal(payload.templateId, "poster_clinical_v1");
assert.equal(payload.title, "术后一周饮食提醒");
assert.equal(payload.heroImage, "网页展示素材库/solution.jpg");
assert.equal(payload.keyPoints.length, 3);
assert.equal(payload.doList[0], "慢慢进食");
assert.equal(payload.redFlags.at(-1), "完全无法进食");
assert.equal(payload.footer.badge, "医生确认后发放");
assert.equal(payload.footer.sourceTag, "团队证据包支持");

console.log("poster-renderer.test.js passed");
