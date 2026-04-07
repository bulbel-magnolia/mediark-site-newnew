export const POSTER_LIMITS = {
  title: 18,
  subtitle: 28,
  keyPoint: 14,
  action: 12,
  redFlag: 10
};

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(Boolean);
}

export function clampPosterText(value, limit) {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(limit - 1, 1)).trim()}…`;
}

function buildPosterSpec({ patient, focusTopics, mustDo, mustAvoid, redFlags, language }) {
  const primaryTopic = focusTopics[0] || "术后恢复";
  const diagnosis = patient.diagnosis || "肿瘤康复";
  const stage = patient.stage || "患者宣教";
  const isEnglish = String(language || "").toLowerCase().startsWith("en");

  return {
    template_id: "poster_clinical_v1",
    aspect_ratio: "4:5",
    title: clampPosterText(isEnglish ? `${primaryTopic} guide` : `${primaryTopic}提醒`, POSTER_LIMITS.title),
    subtitle: clampPosterText(isEnglish ? `${diagnosis} ${stage}` : `${diagnosis}${stage}患者宣教`, POSTER_LIMITS.subtitle),
    key_points: focusTopics.slice(0, 3).map((item) => clampPosterText(item, POSTER_LIMITS.keyPoint)),
    do_list: mustDo.slice(0, 3).map((item) => clampPosterText(item, POSTER_LIMITS.action)),
    dont_list: mustAvoid.slice(0, 3).map((item) => clampPosterText(item, POSTER_LIMITS.action)),
    red_flags: redFlags.slice(0, 3).map((item) => clampPosterText(item, POSTER_LIMITS.redFlag)),
    footer_badge: isEnglish ? "Doctor reviewed" : "医生审核后使用",
    source_tag: isEnglish ? "Evidence bundle" : "团队证据包支持"
  };
}

export function buildMasterJson({ patient = {}, formInput = {}, evidence = [], options = {} }) {
  const language = formInput.language || "zh-CN";
  const isEnglish = String(language).toLowerCase().startsWith("en");
  const focusTopics = normalizeArray(formInput.focusTopics);
  const evidenceBundle = normalizeArray(evidence).map((item) => ({
    id: item.id || "",
    title: item.title || "",
    source: item.source || "",
    claim: item.claim || ""
  }));

  const mustDo = isEnglish
    ? ["Small frequent meals", "Soft warm foods", "Follow review plan"]
    : ["少量多餐", "温软流食", "按时复诊"];
  const mustAvoid = isEnglish
    ? ["Hot or hard foods", "Eating too fast", "Ignoring discomfort"]
    : ["过热过硬", "进食过快", "忽视不适"];
  const redFlags = isEnglish
    ? ["Persistent vomiting", "Severe chest pain", "Unable to eat"]
    : ["持续呕吐", "剧烈胸痛", "无法进食"];

  return {
    meta: {
      case_id: `case-${patient.id || "new"}`,
      schema_version: "1.0",
      created_at: options.createdAt || new Date().toISOString(),
      language,
      owner: "mediark"
    },
    status: {
      text_master: "ready",
      poster_payload: "ready",
      image_generation: "pending",
      video_generation: "pending",
      audio_generation: "pending",
      poster_render: "pending"
    },
    spec: {
      patient_context: {
        patient_id: patient.id || "",
        patient_name: patient.name || "",
        diagnosis: patient.diagnosis || "",
        treatment_stage: patient.stage || "",
        focus_topics: focusTopics,
        education_level: patient.educationLevel || "standard",
        anxiety_level: patient.anxietyLevel || "high",
        family_support: patient.familySupport ?? true,
        patient_tags: normalizeArray(patient.tags)
      },
      evidence_bundle: evidenceBundle,
      clinical_core: {
        clinical_summary: isEnglish
          ? `${patient.diagnosis || "This scenario"} should focus on ${focusTopics.join(", ") || "core recovery points"} for patient education.`
          : `${patient.diagnosis || "当前场景"}需要围绕${focusTopics.join("、") || "核心注意事项"}进行患者宣教。`,
        must_know: focusTopics,
        must_do: mustDo,
        must_avoid: mustAvoid,
        red_flags: redFlags,
        faq: [
          {
            q: isEnglish ? "Why should meals be smaller and more frequent?" : "为什么要少量多餐？",
            a: isEnglish ? "It usually improves tolerance during recovery and reduces discomfort." : "这样更有助于恢复期耐受，减少不适。"
          },
          {
            q: isEnglish ? "When should the patient contact a doctor?" : "什么时候需要联系医生？",
            a: isEnglish ? "Contact the care team promptly if there is persistent vomiting, severe chest pain, or inability to eat." : "出现持续呕吐、剧烈胸痛或无法进食时，应及时就医。"
          }
        ]
      },
      communication_strategy: {
        tone: "reassuring",
        literacy_level: "plain_language",
        family_included: true,
        style_goal: "clinical_education_first",
        doctor_notes: formInput.doctorNotes || ""
      },
      copy_master: {
        one_sentence_takeaway: isEnglish ? "In early recovery, go slower, choose softer foods, and watch for red flags." : "恢复期最重要的是慢一点、软一点、警惕危险信号。",
        short_summary: isEnglish
          ? `${patient.nameEn || patient.name || "The patient"} should focus on ${focusTopics.join(", ") || "recovery education"} right now.`
          : `${patient.name || "患者"}当前最需要关注的是${focusTopics.join("、") || "恢复期护理"}。`,
        narration_script: isEnglish
          ? `${patient.nameEn || patient.name || "The patient"} is currently in ${patient.stageEn || patient.stage || "recovery"}. Please focus on ${focusTopics.join(", ") || "diet and red flags"}.`
          : `${patient.name || "患者"}当前处于${patient.stage || "恢复期"}，请重点关注${focusTopics.join("、") || "饮食和危险信号"}。`,
        doctor_review_note: isEnglish ? "Pending doctor review before release." : "待医生审核后发布。"
      },
      poster_spec: buildPosterSpec({ patient, focusTopics, mustDo, mustAvoid, redFlags, language }),
      image_spec: {
        style: "clean_medical_poster",
        palette: ["#0F4C81", "#D9EAF7", "#F7FBFF"],
        assets: []
      },
      video_spec: {
        duration_sec: 5,
        shots: []
      },
      audio_spec: {
        voice_style: "warm_clinical",
        language: formInput.language || "zh-CN",
        script_source: "spec.copy_master.narration_script"
      }
    },
    artifacts: {
      images: [],
      videos: [],
      audio: [],
      poster: {
        html: "",
        png: "",
        pdf: ""
      }
    },
    review: {
      doctor_review_required: true,
      doctor_review_status: "pending",
      medical_risk_level: "low",
      blocked_terms: [],
      final_approved_by: ""
    }
  };
}
