export const FALLBACK_PATIENTS = {
  "20250801": {
    id: "20250801",
    name: "张建国",
    nameEn: "Zhang Jianguo",
    diagnosis: "食管癌术后恢复期",
    diagnosisEn: "Post-op esophageal cancer recovery",
    stage: "术后一周",
    stageEn: "Post-op week 1",
    tags: ["高焦虑", "低健康素养", "家属参与"],
    compliance: 85,
    educationLevel: "low",
    anxietyLevel: "high",
    familySupport: true
  },
  "20250722": {
    id: "20250722",
    name: "李淑芬",
    nameEn: "Li Shufen",
    diagnosis: "肺癌化疗期",
    diagnosisEn: "Chemotherapy phase lung cancer",
    stage: "化疗中",
    stageEn: "During chemotherapy",
    tags: ["副作用管理", "方言沟通"],
    compliance: 45,
    educationLevel: "standard",
    anxietyLevel: "medium",
    familySupport: true
  }
};

const EVIDENCE_LIBRARY = {
  "术后饮食": {
    id: "E1",
    title: "术后饮食指导",
    source: "团队指南摘录",
    claim: "少量多餐，避免过热、过硬和过快进食。"
  },
  "吞咽训练": {
    id: "E2",
    title: "吞咽训练原则",
    source: "团队审核内容",
    claim: "吞咽训练应循序渐进，并观察是否出现疼痛或明显梗阻感。"
  },
  "危险信号": {
    id: "E3",
    title: "危险信号识别",
    source: "团队审核内容",
    claim: "持续呕吐、剧烈胸痛、无法进食等情况需要及时联系医生。"
  },
  "心理支持": {
    id: "E4",
    title: "焦虑沟通建议",
    source: "团队沟通手册",
    claim: "恢复期沟通应使用具体、短句、可执行的表达，并允许家属共同接收信息。"
  }
};

export function resolvePatientRecord(patientId) {
  const storedPatients = JSON.parse(localStorage.getItem("mediark_patients") || "[]");
  const stored = storedPatients.find((item) => item.id === patientId);

  if (stored) {
    return {
      id: stored.id,
      name: stored.name || stored.realName || "新患者",
      nameEn: stored.name_en || stored.realName || "New Patient",
      diagnosis: stored.diagnosis || "待补充诊断",
      diagnosisEn: stored.diagnosis_en || stored.diagnosis || "Diagnosis pending",
      stage: stored.stage || stored.treatment_stage || "待补充阶段",
      stageEn: stored.stage_en || stored.stage || "Stage pending",
      tags: Array.isArray(stored.tags) ? stored.tags.map((tag) => typeof tag === "object" ? tag.text : tag) : [],
      compliance: stored.compliance || 0,
      educationLevel: stored.educationLevel || "standard",
      anxietyLevel: stored.anxietyLevel || "medium",
      familySupport: stored.familySupport ?? true
    };
  }

  return FALLBACK_PATIENTS[patientId] || {
    id: patientId || "new",
    name: "新患者",
    nameEn: "New Patient",
    diagnosis: "待补充诊断",
    diagnosisEn: "Diagnosis pending",
    stage: "待补充阶段",
    stageEn: "Stage pending",
    tags: ["待评估"],
    compliance: 0,
    educationLevel: "standard",
    anxietyLevel: "medium",
    familySupport: true
  };
}

export function buildEvidenceBundle(focusTopics = []) {
  return focusTopics
    .map((topic) => EVIDENCE_LIBRARY[topic])
    .filter(Boolean);
}

export function buildMockArtifacts() {
  return {
    images: [
      {
        id: "hero_image",
        role: "poster_hero",
        provider: "byteplus-modelark",
        model: "bytedance-seedream-5.0-lite",
        status: "mock-ready",
        path: "科普作品素材库/封面图存放文件夹/肿瘤的治疗方法.jpg"
      },
      {
        id: "scene_reference",
        role: "video_reference",
        provider: "byteplus-modelark",
        model: "bytedance-seedream-5.0-lite",
        status: "mock-ready",
        path: "科普作品素材库/封面图存放文件夹/肿瘤疫苗：从预防到治疗的免疫革命.png"
      }
    ],
    videos: [
      {
        id: "short_video",
        provider: "byteplus-modelark",
        model: "seedance-1-5-pro-251215",
        status: "queued",
        thumbnail: "网页展示素材库/features/智能科普生成.png",
        path: ""
      }
    ],
    audio: [
      {
        id: "narration",
        provider: "openai-compatible",
        model: "tts-placeholder",
        status: "queued",
        path: ""
      }
    ],
    poster: {
      html: "browser-generated",
      png: "",
      pdf: ""
    }
  };
}
