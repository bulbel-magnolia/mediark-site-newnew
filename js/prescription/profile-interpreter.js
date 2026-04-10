// 患者画像解释器：把 tags 翻译成 LLM 可执行的生成指令
// 输入: patient.tags 数组 (格式: [{text, category}]) + patient.notes 字符串
// 输出: { tone, literacy, formatPreference, instructions[] }

const TAG_RULES = [
  // 心理状态
  { match: ["高焦虑", "焦虑"], tone: "reassuring", instruction: "患者焦虑程度高，使用鼓励性、安抚性语气，避免提及死亡率、复发率等负面表述，多用\"很多患者都能够恢复\"这样的正向措辞" },
  { match: ["抑郁倾向", "抑郁"], tone: "gentle", instruction: "患者有抑郁倾向，使用温和、积极的语气，强调希望和可控性，避免强调长期治疗的艰难" },
  { match: ["恐惧进食"], instruction: "患者有进食恐惧心理，饮食指导需特别强调安全性和循序渐进，使用\"少量尝试\"这种降低心理负担的表达" },
  { match: ["情绪稳定", "配合度高"], instruction: "患者情绪稳定配合度好，可以直接给出清晰的执行建议" },
  { match: ["否认病情"], instruction: "患者否认病情，沟通语气需柔和但坚定，强调科学依据和客观数据" },

  // 学历与理解水平
  { match: ["小学学历"], literacy: "plain", instruction: "患者学历为小学，使用最通俗的语言，避免医学术语，用日常生活比喻（如\"胃像气球\"）解释医学概念" },
  { match: ["高中学历"], literacy: "standard", instruction: "患者有基础医学常识，可使用常见医学词汇但需解释" },
  { match: ["退休教师", "关注循证数据", "专家导向"], literacy: "advanced", instruction: "患者教育水平高且重视证据，可以使用专业术语，在关键建议处引用循证来源（如 NCCN/CSCO 指南）和具体数据（如 HR、有效率）" },

  // 社会背景
  { match: ["农村独居", "独居老人"], instruction: "患者独居无人照护，建议内容要强调自我监测的具体指标和紧急求助途径（120、邻居、村医）" },
  { match: ["经济困难"], instruction: "患者经济困难，尽量推荐低成本方案，避免昂贵药物或检查的暗示" },
  { match: ["家属支持好"], instruction: "患者有良好家属支持，可以在内容中加入家属协作建议，如\"请您的家人帮助监督进食\"\"提醒家属一起记录体重\"" },

  // 内容偏好
  { match: ["视觉偏好(短视频)", "视觉偏好"], formatPreference: "video", instruction: "患者偏好短视频形式，文案结构要适合 30 秒短视频分镜：开头抓眼球、中间要点清晰、结尾行动指令" },
  { match: ["图文偏好(大字)", "大字"], formatPreference: "poster", instruction: "患者视力或阅读偏好需要大字海报，文字要简短有力，每条不超过 10 字，适合大字号显示" },
  { match: ["语音偏好", "方言"], instruction: "患者偏好语音形式，narration_script 字段要写得口语化、有节奏感，适合朗读" },

  // 功能评估
  { match: ["吞咽困难"], instruction: "患者有吞咽困难，饮食指导要格外细致，明确列出食物性状（清流质/半流质/软食）和每次进食量的具体毫升数" },
  { match: ["进食疼痛"], instruction: "患者进食疼痛，饮食指导要强调温凉（避免过热）、流质、避免刺激性食物" },

  // 营养状态
  { match: ["BMI", "营养不良", "NRS2002"], instruction: "患者营养状况偏差，饮食建议要更具体、更关注热量和蛋白质摄入，推荐口服营养补充剂(ONS)和高蛋白食物" },

  // 症状管理
  { match: ["化疗后恶心", "恶心"], instruction: "患者有化疗后恶心，饮食建议要强调少量多餐、避免油腻、配合止吐药按时服用" },
  { match: ["白细胞减少", "骨髓抑制"], instruction: "患者白细胞低，建议内容要强调感染预防、避免生食和人群密集场所" },
  { match: ["放射性食管炎"], instruction: "患者有放射性食管炎，饮食要格外温凉、柔软，避免物理和化学刺激" },
  { match: ["反流症状"], instruction: "患者有反流，强调餐后不平卧 30 分钟、睡前 2 小时不进食、床头抬高 15-30 度" }
];

function mergeUnique(existing, incoming) {
  for (const item of incoming) {
    if (!existing.includes(item)) existing.push(item);
  }
  return existing;
}

export function interpretPatientProfile(tags = [], notes = "") {
  const profile = {
    tone: null,
    literacy: null,
    formatPreference: null,
    instructions: []
  };

  const tagTexts = (Array.isArray(tags) ? tags : [])
    .map((t) => (typeof t === "string" ? t : t?.text || ""))
    .filter(Boolean);

  for (const rule of TAG_RULES) {
    const matched = rule.match.some((key) =>
      tagTexts.some((tagText) => tagText.includes(key))
    );
    if (!matched) continue;

    if (rule.tone && !profile.tone) profile.tone = rule.tone;
    if (rule.literacy && !profile.literacy) profile.literacy = rule.literacy;
    if (rule.formatPreference && !profile.formatPreference) profile.formatPreference = rule.formatPreference;
    if (rule.instruction) mergeUnique(profile.instructions, [rule.instruction]);
  }

  // 如果有 notes，作为独立的指令加入
  if (notes && typeof notes === "string" && notes.trim()) {
    profile.instructions.push(`医生对该患者的额外备注：${notes.trim().slice(0, 300)}`);
  }

  return profile;
}
