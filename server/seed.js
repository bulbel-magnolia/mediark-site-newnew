import { fileURLToPath } from "node:url";

import { all, createDatabase, get, run, toJson } from "./db.js";
import { hashPassword } from "./lib/auth.js";

export function buildDefaultSchemaDefinition() {
  return {
    form_sections: [
      {
        id: "patient",
        title: "Patient Profile",
        description: "Clinical baseline required for the education bundle.",
        fields: [
          { id: "patient_name", label: "Patient Name", type: "text", bind: "patient.name", required: true },
          { id: "patient_diagnosis", label: "Diagnosis", type: "text", bind: "patient.diagnosis", required: true },
          { id: "patient_stage", label: "Clinical Stage", type: "text", bind: "patient.stage" }
        ]
      },
      {
        id: "prescription",
        title: "Education Prescription",
        description: "Core direction for JSON-driven text, poster, image and video generation.",
        fields: [
          {
            id: "language",
            label: "Interface Language",
            type: "select",
            bind: "form.language",
            required: true,
            options: ["zh-CN", "en"]
          },
          {
            id: "focus_topics",
            label: "Focus Topics",
            type: "multiselect",
            bind: "form.focusTopics",
            required: true,
            options: ["medication", "red flags", "follow-up", "family support", "lifestyle"]
          },
          { id: "doctor_notes", label: "Doctor Notes", type: "textarea", bind: "form.doctorNotes" },
          { id: "video_duration", label: "Video Duration (sec)", type: "number", bind: "form.videoDurationSec" },
          { id: "work_title", label: "Work Title", type: "text", bind: "work.title", required: true },
          { id: "work_topic", label: "Topic", type: "text", bind: "work.topic" },
          {
            id: "work_format",
            label: "Format",
            type: "select",
            bind: "work.format",
            options: ["poster-video", "poster-image", "image-video", "poster-only", "video-only"]
          },
          {
            id: "work_audience",
            label: "Audience",
            type: "select",
            bind: "work.audience",
            options: ["patient", "patient-family", "caregiver", "community"]
          }
        ]
      }
    ]
  };
}

function seedUser(db, { username, displayName, role, password }) {
  const existing = get(db, "SELECT id FROM users WHERE username = :username", { username });

  if (existing) {
    run(
      db,
      `UPDATE users
          SET display_name = :displayName,
              role = :role,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      {
        id: existing.id,
        displayName,
        role
      }
    );
    return existing.id;
  }

  const result = run(
    db,
    `INSERT INTO users (username, display_name, role, password_hash)
     VALUES (:username, :displayName, :role, :passwordHash)`,
    {
      username,
      displayName,
      role,
      passwordHash: hashPassword(password)
    }
  );

  return Number(result.lastInsertRowid);
}

function seedPatients(db, doctorId) {
  const existing = get(db, "SELECT id FROM patients WHERE created_by = :doctorId LIMIT 1", { doctorId });
  if (existing) return;

  const patients = [
    {
      name: "张建国",
      diagnosis: "食管鳞状细胞癌 (中段)",
      stage: "术后第1周 (Ivor-Lewis术后)",
      tags: [
        { text: "高焦虑", category: "心理状态" },
        { text: "恐惧进食", category: "心理状态" },
        { text: "小学学历", category: "社会背景" },
        { text: "农村独居", category: "社会背景" },
        { text: "经济困难", category: "社会背景" },
        { text: "视觉偏好(短视频)", category: "内容偏好" },
        { text: "吞咽困难Ⅱ级", category: "功能评估" },
        { text: "BMI 17.8(营养不良)", category: "营养状态" },
        { text: "NRS2002≥3分", category: "营养状态" }
      ],
      notes: "Ivor-Lewis术后第7天，胃管已拔除，开始经口流食试验。患者极度焦虑进食会导致吻合口瘘，需重点心理疏导+饮食指导。家属（儿子）在外地打工，主要由老伴照护。"
    },
    {
      name: "李淑芬",
      diagnosis: "食管鳞状细胞癌 (下段)",
      stage: "新辅助化疗中 (TP方案第2周期)",
      tags: [
        { text: "情绪稳定", category: "心理状态" },
        { text: "配合度高", category: "心理状态" },
        { text: "高中学历", category: "社会背景" },
        { text: "家属支持好", category: "社会背景" },
        { text: "图文偏好(大字)", category: "内容偏好" },
        { text: "化疗后恶心Ⅱ度", category: "症状管理" },
        { text: "白细胞减少", category: "症状管理" },
        { text: "BMI 20.1", category: "营养状态" },
        { text: "PG-SGA B级", category: "营养状态" }
      ],
      notes: "TP方案(紫杉醇+顺铂)新辅助化疗第2周期，主要不良反应为恶心呕吐和骨髓抑制。患者配合度好，女儿全程陪护。需重点关注化疗期间营养支持和感染预防。"
    },
    {
      name: "王德明",
      diagnosis: "食管鳞状细胞癌 (上段)",
      stage: "根治性放化疗中",
      tags: [
        { text: "抑郁倾向", category: "心理状态" },
        { text: "否认病情", category: "心理状态" },
        { text: "退休教师", category: "社会背景" },
        { text: "关注循证数据", category: "内容偏好" },
        { text: "专家导向", category: "内容偏好" },
        { text: "放射性食管炎Ⅱ级", category: "症状管理" },
        { text: "进食疼痛", category: "症状管理" },
        { text: "吞咽困难Ⅲ级", category: "功能评估" },
        { text: "BMI 18.5(临界)", category: "营养状态" }
      ],
      notes: "颈段食管鳞癌，不可手术，接受根治性同步放化疗(50.4Gy/28F + TP方案)。放射性食管炎导致进食疼痛，需要疼痛管理和营养支持。患者为退休中学教师，对治疗方案理解力强但情绪低落。"
    },
    {
      name: "赵铁柱",
      diagnosis: "食管鳞状细胞癌 (中段)",
      stage: "术后3个月 (随访康复期)",
      tags: [
        { text: "焦虑复发", category: "心理状态" },
        { text: "睡眠障碍", category: "心理状态" },
        { text: "初中学历", category: "社会背景" },
        { text: "独居老人", category: "社会背景" },
        { text: "语音偏好(方言)", category: "内容偏好" },
        { text: "反流症状", category: "症状管理" },
        { text: "倾倒综合征", category: "症状管理" },
        { text: "吞咽困难Ⅰ级", category: "功能评估" },
        { text: "体重下降8kg", category: "营养状态" },
        { text: "BMI 19.2", category: "营养状态" }
      ],
      notes: "McKeown三切口术后3个月，目前软食阶段。主要问题：反流、倾倒综合征、体重持续下降。极度担心复发，每次随访前失眠严重。需要：反流管理、营养追赶、心理干预。"
    }
  ];

  for (const p of patients) {
    run(db, `INSERT INTO patients (name, diagnosis, stage, cancer_type, tags_json, notes, created_by)
             VALUES (:name, :diagnosis, :stage, :cancerType, :tagsJson, :notes, :createdBy)`, {
      name: p.name,
      diagnosis: p.diagnosis,
      stage: p.stage,
      cancerType: "esophageal",
      tagsJson: toJson(p.tags),
      notes: p.notes,
      createdBy: doctorId
    });
  }
}

function seedKnowledge(db) {
  const existing = get(db, "SELECT id FROM knowledge_entries LIMIT 1");
  if (existing) return;

  const entries = [
    {
      cancerType: "esophageal", category: "guideline",
      title: "NCCN 食管癌及食管胃交界部癌临床实践指南",
      titleEn: "NCCN Guidelines: Esophageal and Esophagogastric Junction Cancers",
      source: "NCCN", authors: "Ajani JA, D'Amico TA, et al.", year: 2025,
      summary: "NCCN指南是食管癌诊疗的国际权威标准。2025版(V1)更新要点：强调内镜超声(EUS)和PET-CT在分期中的互补作用；对cT1b-T2N0推荐内镜切除或手术；局部进展期(≥T2或N+)推荐新辅助放化疗(CROSS方案)或围手术期化疗+免疫；不可切除者推荐根治性放化疗联合免疫检查点抑制剂。",
      keyPoints: ["cT1a浅表癌首选内镜下切除(EMR/ESD)", "局部进展期首选新辅助放化疗后手术", "鳞癌一线推荐帕博利珠单抗+化疗(KEYNOTE-590)", "术后病理有残留者推荐纳武利尤单抗辅助治疗(CheckMate 577)", "MDT多学科讨论贯穿全程"],
      evidenceLevel: "1", url: "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1433",
      tags: ["食管癌", "NCCN", "临床指南", "多学科", "免疫治疗"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "CSCO 食管癌诊疗指南(2024版)",
      titleEn: "CSCO Guidelines for Esophageal Cancer 2024",
      source: "CSCO (中国临床肿瘤学会)", authors: "黄镜, 王鑫 等", year: 2024,
      summary: "CSCO指南结合中国食管癌流行病学特点(鳞癌为主，占90%以上)制定。2024版新增：ESCORT-1st方案(卡瑞利珠单抗+化疗)作为晚期一线I级推荐；新辅助免疫联合化疗作为II级推荐；术后辅助免疫治疗纳入推荐。强调中国人群特有的高发区筛查策略和早诊早治体系。",
      keyPoints: ["中国食管癌以鳞癌为主(>90%)，与欧美腺癌为主不同", "术前新辅助：放化疗(I级) / 免疫+化疗(II级)", "晚期一线：PD-1抑制剂+化疗为I级推荐", "高危人群(40岁以上、高发区)建议内镜筛查", "重视围手术期营养支持和加速康复(ERAS)"],
      evidenceLevel: "1", url: "",
      tags: ["食管癌", "CSCO", "中国指南", "鳞癌", "免疫治疗"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "CROSS试验：食管癌新辅助放化疗的里程碑研究",
      titleEn: "CROSS Trial: Neoadjuvant Chemoradiotherapy for Esophageal Cancer",
      source: "NEJM", authors: "van Hagen P, Hulshof MC, et al.", year: 2012,
      summary: "CROSS试验是食管癌新辅助治疗的里程碑研究。368例可切除食管癌或食管胃交界部癌患者随机分为新辅助放化疗(卡铂+紫杉醇+41.4Gy)后手术组vs直接手术组。结果：新辅助组中位OS 49.4个月 vs 直接手术组24.0个月(HR 0.657)；R0切除率92% vs 69%；病理完全缓解率(pCR)29%。该方案已成为全球食管癌新辅助治疗的标准方案。",
      keyPoints: ["新辅助放化疗显著延长总生存期(中位OS 49.4 vs 24.0个月)", "R0切除率大幅提高(92% vs 69%)", "pCR率29%，鳞癌亚组pCR率更高(49%)", "卡铂AUC2+紫杉醇50mg/m²，周疗×5周，放疗41.4Gy/23F", "该方案已成为NCCN I类推荐"],
      evidenceLevel: "1A", url: "https://doi.org/10.1056/NEJMoa1112088",
      tags: ["食管癌", "新辅助放化疗", "CROSS", "随机对照试验", "手术"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "CheckMate 577：食管癌术后辅助免疫治疗",
      titleEn: "CheckMate 577: Adjuvant Nivolumab in Esophageal Cancer",
      source: "NEJM", authors: "Kelly RJ, Ajani JA, et al.", year: 2021,
      summary: "CheckMate 577是首个证实食管癌术后辅助免疫治疗获益的III期临床试验。794例经新辅助放化疗后手术、术后病理未达pCR的食管/食管胃交界部癌患者，随机接受纳武利尤单抗(240mg Q2W)或安慰剂治疗1年。结果：纳武利尤单抗组中位DFS 22.4个月 vs 安慰剂组11.0个月(HR 0.69, p<0.001)。此研究改变了临床实践，使术后辅助免疫治疗成为标准。",
      keyPoints: ["术后辅助纳武利尤单抗使DFS翻倍(22.4 vs 11.0个月)", "无论鳞癌还是腺癌亚组均获益", "适用于新辅助放化疗后手术、未达pCR的患者", "治疗方案：纳武利尤单抗240mg Q2W或480mg Q4W，持续1年", "安全性可控，未增加术后并发症"],
      evidenceLevel: "1A", url: "https://doi.org/10.1056/NEJMoa2032125",
      tags: ["食管癌", "免疫治疗", "辅助治疗", "纳武利尤单抗", "CheckMate 577"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "KEYNOTE-590：帕博利珠单抗联合化疗一线治疗晚期食管癌",
      titleEn: "KEYNOTE-590: Pembrolizumab Plus Chemotherapy for Advanced Esophageal Cancer",
      source: "The Lancet", authors: "Sun JM, Shen L, et al.", year: 2021,
      summary: "KEYNOTE-590是全球多中心III期试验，749例晚期/转移性食管鳞癌或腺癌及Siewert I型食管胃交界部腺癌患者，随机接受帕博利珠单抗+化疗(5-FU+顺铂)或安慰剂+化疗。帕博利珠单抗组在所有预设人群中均显示OS和PFS获益：鳞癌CPS≥10亚组中位OS 13.9 vs 8.8个月(HR 0.57)。该研究确立了PD-1抑制剂联合化疗作为晚期食管癌一线治疗标准。",
      keyPoints: ["帕博利珠单抗+化疗显著改善OS和PFS", "鳞癌CPS≥10亚组获益最大(OS HR 0.57)", "化疗方案：顺铂80mg/m² D1 + 5-FU 800mg/m²/d D1-5 Q3W", "NCCN 1类推荐用于晚期食管癌一线治疗", "中国食管鳞癌患者占比高，临床获益显著"],
      evidenceLevel: "1A", url: "https://doi.org/10.1016/S0140-6736(21)01234-4",
      tags: ["食管癌", "免疫治疗", "帕博利珠单抗", "一线治疗", "KEYNOTE-590"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "ESCORT-1st：卡瑞利珠单抗联合化疗一线治疗食管鳞癌",
      titleEn: "ESCORT-1st: Camrelizumab Plus Chemotherapy for Esophageal Squamous Cell Carcinoma",
      source: "JAMA", authors: "Luo H, Lu J, Bai Y, et al.", year: 2021,
      summary: "ESCORT-1st是中国原创的III期临床试验，596例晚期食管鳞癌患者随机接受卡瑞利珠单抗(200mg Q3W)+化疗(紫杉醇+顺铂)或安慰剂+化疗。卡瑞利珠单抗组中位OS 15.3个月 vs 12.0个月(HR 0.70, p<0.001)，中位PFS 6.9 vs 5.6个月(HR 0.56)。该研究使卡瑞利珠单抗成为CSCO指南I级推荐的食管鳞癌一线方案。",
      keyPoints: ["卡瑞利珠单抗+化疗显著延长OS(15.3 vs 12.0个月)", "PFS获益显著(HR 0.56)", "中国自主研发PD-1抑制剂", "CSCO指南I级推荐方案", "安全性与KEYNOTE-590类似"],
      evidenceLevel: "1A", url: "https://doi.org/10.1001/jama.2021.12836",
      tags: ["食管癌", "鳞癌", "卡瑞利珠单抗", "中国原创", "ESCORT-1st"]
    },
    {
      cancerType: "esophageal", category: "staging",
      title: "食管癌TNM分期系统（AJCC第8版）",
      titleEn: "AJCC 8th Edition TNM Staging for Esophageal Cancer",
      source: "AJCC/UICC", authors: "Rice TW, Ishwaran H, et al.", year: 2017,
      summary: "AJCC第8版食管癌分期系统将食管癌分为临床分期(cTNM)、病理分期(pTNM)和新辅助治疗后病理分期(ypTNM)三套独立系统。T分期基于肿瘤浸润深度(T1黏膜/黏膜下层→T4邻近器官)，N分期基于区域淋巴结转移数目(N0-N3)。鳞癌和腺癌采用不同的分期分组，反映不同的生物学行为。",
      keyPoints: ["T1a(黏膜层) T1b(黏膜下层) T2(固有肌层) T3(外膜) T4a(可切除邻近结构) T4b(不可切除)", "N0(无转移) N1(1-2枚) N2(3-6枚) N3(≥7枚)", "鳞癌和腺癌分期分组不同", "增加了ypTNM分期用于新辅助治疗后评估", "G分级(分化程度)和肿瘤位置影响分期分组"],
      evidenceLevel: "2A", url: "",
      tags: ["食管癌", "TNM分期", "AJCC", "病理", "分期系统"]
    },
    {
      cancerType: "esophageal", category: "regimen",
      title: "食管癌常用化疗方案汇总",
      titleEn: "Standard Chemotherapy Regimens for Esophageal Cancer",
      source: "NCCN/CSCO综合", authors: "", year: 2024,
      summary: "食管癌的标准化疗方案包括：1) CROSS方案(新辅助)：卡铂AUC2+紫杉醇50mg/m² 周疗×5+放疗41.4Gy；2) TP方案：紫杉醇175mg/m²+顺铂75mg/m² Q3W；3) FOLFOX方案：奥沙利铂85mg/m²+亚叶酸钙+5-FU Q2W；4) CF方案：顺铂80mg/m² D1+5-FU 800mg/m²/d D1-5 Q3W。联合免疫治疗已成为标准一线方案。",
      keyPoints: ["CROSS方案是新辅助放化疗金标准", "TP方案(紫杉醇+顺铂)是中国常用方案", "FOLFOX方案适用于不耐受顺铂的患者", "一线治疗推荐化疗联合PD-1抑制剂", "二线可选多西他赛、伊立替康或免疫单药"],
      evidenceLevel: "1", url: "",
      tags: ["食管癌", "化疗方案", "CROSS", "TP方案", "FOLFOX"]
    },
    {
      cancerType: "esophageal", category: "nutrition",
      title: "食管癌围手术期营养管理专家共识",
      titleEn: "Expert Consensus on Perioperative Nutrition for Esophageal Cancer",
      source: "ESPEN / 中华医学会肠外肠内营养学分会", authors: "石汉平 等", year: 2023,
      summary: "食管癌患者术前营养不良发生率高达60-80%。围手术期营养管理要点：术前进行NRS2002营养风险筛查(≥3分需营养干预)；术前7-14天开始口服营养补充(ONS)或肠内营养；术后早期(24-48h)经空肠营养管开始肠内营养；遵循阶梯式饮食恢复(清流→全流→半流→软食→普食，每阶段3-5天)；出院后持续营养随访至少3个月。",
      keyPoints: ["术前NRS2002筛查≥3分必须营养干预", "术前7-14天开始ONS(口服营养补充)", "术后24-48h开始经空肠管肠内营养", "阶梯式饮食恢复：每阶段3-5天逐步过渡", "出院后持续营养监测≥3个月，目标BMI≥18.5", "每餐少量多次(6-8餐/日)，进食后30分钟勿平卧"],
      evidenceLevel: "2A", url: "",
      tags: ["食管癌", "营养管理", "围手术期", "ESPEN", "肠内营养"]
    },
    {
      cancerType: "esophageal", category: "nutrition",
      title: "食管癌术后饮食阶梯恢复方案",
      titleEn: "Postoperative Dietary Progression Protocol for Esophagectomy",
      source: "北大肿瘤医院胸外科", authors: "临床护理团队", year: 2024,
      summary: "食管癌根治术后饮食恢复分为五个阶段：第1阶段(术后1-3天)：禁食，经空肠管肠内营养+静脉营养；第2阶段(术后3-7天)：清流质(温水→米汤→果汁)，每次30-50ml；第3阶段(术后1-2周)：全流质(稀粥→牛奶→蛋花汤)，每次100-150ml；第4阶段(术后2-4周)：半流质(软面→蒸蛋→肉糜)，每次150-200ml；第5阶段(术后1-3月)：软食过渡至普食。全程少量多餐(6-8次/日)，进食速度慢，细嚼慢咽。",
      keyPoints: ["严格遵循五阶段饮食恢复方案", "每次进食量从30ml逐步增加到200ml", "全程少量多餐(6-8次/日)", "进食后保持坐位或半坐位30分钟以上", "避免过冷/过热/刺激性食物", "每周测体重，若下降超过2%需就医"],
      evidenceLevel: "2B", url: "",
      tags: ["食管癌", "术后饮食", "阶梯恢复", "患者教育", "护理"]
    },
    {
      cancerType: "esophageal", category: "rehabilitation",
      title: "食管癌术后吞咽功能康复训练指南",
      titleEn: "Swallowing Rehabilitation After Esophagectomy",
      source: "中国康复医学会", authors: "窦祖林 等", year: 2023,
      summary: "食管癌术后吞咽困难是常见并发症(发生率30-60%)。康复训练包括：1)口腔运动训练(舌运动、下颌活动)；2)呼吸训练(腹式呼吸、缩唇呼吸)；3)吞咽手法训练(Mendelsohn手法、声门上吞咽)；4)体位代偿(进食时头前屈30°)。建议术后3天开始口腔运动训练，拔管后开始经口进食训练。吞咽困难严重者(VFS评估III级以上)需专业康复师介入。",
      keyPoints: ["术后吞咽困难发生率30-60%", "术后第3天可开始口腔运动训练", "进食体位：坐位，头前屈30°", "Mendelsohn手法和声门上吞咽技术有效", "VFS(视频透视吞咽检查)评估吞咽功能分级", "严重吞咽困难需康复科会诊"],
      evidenceLevel: "2B", url: "",
      tags: ["食管癌", "吞咽康复", "术后康复", "患者教育", "康复训练"]
    },
    {
      cancerType: "esophageal", category: "rehabilitation",
      title: "食管癌患者心理干预与社会支持",
      titleEn: "Psychological Intervention and Social Support for Esophageal Cancer Patients",
      source: "中华护理学会肿瘤护理专委会", authors: "", year: 2023,
      summary: "食管癌患者心理障碍发生率高达40-70%，主要表现为焦虑(术前恐惧、对进食的恐惧)、抑郁(体像改变、社交退缩)和癌症复发恐惧(FCR)。推荐的干预措施：1)认知行为疗法(CBT)改善焦虑抑郁；2)正念减压(MBSR)缓解治疗相关压力；3)同伴支持(病友互助小组)；4)家属心理教育(照护者负担管理)。焦虑PHQ-9≥10分或HAD-A≥8分建议转诊心理科。",
      keyPoints: ["食管癌患者焦虑抑郁发生率40-70%", "进食恐惧是食管癌特有的心理问题", "认知行为疗法(CBT)是一线心理干预", "正念减压(MBSR)可缓解治疗压力", "PHQ-9≥10或HAD-A≥8建议心理科转诊", "家属照护者同样需要心理支持"],
      evidenceLevel: "2B", url: "",
      tags: ["食管癌", "心理干预", "焦虑", "抑郁", "患者教育", "社会支持"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌术后随访与监测规范",
      titleEn: "Follow-up and Surveillance After Esophagectomy",
      source: "NCCN/CSCO综合", authors: "", year: 2024,
      summary: "食管癌根治术后随访计划：术后2年内每3-6个月随访一次，2-5年每6-12个月随访。随访内容包括：病史询问和体格检查、血液学检查(肿瘤标志物CEA/SCC等)、影像学(增强CT每6个月，必要时PET-CT)、上消化道内镜(术后1年内至少1次)。重点关注吻合口复发、淋巴结转移和远处转移(肝、肺、骨最常见)。",
      keyPoints: ["术后2年内每3-6个月随访", "增强CT每6个月复查(胸+腹)", "术后1年内至少做1次胃镜检查吻合口", "肿瘤标志物：鳞癌看SCC，腺癌看CEA", "远处转移好发部位：肝、肺、骨", "出现吞咽困难加重、体重骤降需提前就医"],
      evidenceLevel: "2A", url: "",
      tags: ["食管癌", "术后随访", "监测", "复发", "患者教育"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌放射性食管炎的预防与管理",
      titleEn: "Prevention and Management of Radiation Esophagitis",
      source: "中国医师协会放射肿瘤治疗医师分会", authors: "", year: 2023,
      summary: "放射性食管炎是食管癌放疗最常见的急性不良反应(发生率80-90%)。分级：I级(轻度吞咽困难)→II级(需流质饮食)→III级(需肠内营养或静脉营养)→IV级(完全梗阻/穿孔)。管理策略：预防性使用质子泵抑制剂(PPI)、黏膜保护剂；II级以上给予利多卡因含漱液止痛；III级暂停放疗、给予肠内营养支持；注意与放疗剂量-体积关系(V50<50%可降低III级发生率)。",
      keyPoints: ["放射性食管炎发生率80-90%", "常在放疗第2-3周出现", "预防：PPI+黏膜保护剂", "II级以上：利多卡因含漱液止痛", "III级需暂停放疗、启动肠内营养", "V50<50%可降低严重食管炎风险"],
      evidenceLevel: "2A", url: "",
      tags: ["食管癌", "放射性食管炎", "放疗", "不良反应", "支持治疗"]
    },
    {
      cancerType: "esophageal", category: "rehabilitation",
      title: "食管癌术后常见并发症识别与应急处理（患者版）",
      titleEn: "Recognizing Postoperative Complications: Patient Guide",
      source: "北大肿瘤医院护理部", authors: "临床护理团队", year: 2024,
      summary: "食管癌术后患者及家属需要识别的危险信号(红旗症状)：1)吻合口瘘征象：突发胸痛、高热(>38.5°C)、颈部皮下气肿、引流液浑浊；2)出血征象：呕血、黑便、引流液鲜红>100ml/h；3)肺部并发症：呼吸困难加重、咳脓痰、血氧<90%；4)喉返神经损伤：声音嘶哑、饮水呛咳。出现以上任何症状必须立即就医或拨打120。日常预防：坚持深呼吸和咳嗽训练、禁烟、规范进食。",
      keyPoints: ["高热(>38.5°C)+胸痛警惕吻合口瘘", "呕血或引流液鲜红提示出血", "呼吸困难加重+血氧<90%必须急诊", "声音嘶哑提示喉返神经损伤", "以上红旗症状需立即就医", "日常坚持深呼吸训练预防肺部并发症"],
      evidenceLevel: null, url: "",
      tags: ["食管癌", "术后并发症", "红旗症状", "患者教育", "急救"]
    },
    // --- 新增临床试验 (6条) ---
    {
      cancerType: "esophageal", category: "trial",
      title: "ATTRACTION-3：纳武利尤单抗二线治疗晚期食管鳞癌III期研究",
      titleEn: "ATTRACTION-3: Nivolumab vs Chemotherapy as Second-Line for Advanced ESCC",
      source: "Lancet Oncology", authors: "Kato K et al.", year: 2019,
      summary: "III期RCT证实纳武利尤单抗二线治疗晚期食管鳞癌较化疗显著改善OS(10.9 vs 8.4个月,HR 0.77),≥3级不良反应仅18% vs 63%,安全性优势突出,奠定免疫单药二线治疗地位。获FDA/EMA批准用于食管鳞癌二线治疗。",
      keyPoints: ["纳入419例既往含氟尿嘧啶/铂类方案失败的晚期食管鳞癌", "中位OS显著改善:10.9个月 vs 8.4个月(HR 0.77, P=0.019)", "12个月OS率47% vs 34%,18个月OS率31% vs 21%", "≥3级治疗相关不良事件显著降低(18% vs 63%)", "获FDA/EMA批准用于食管鳞癌二线治疗"],
      evidenceLevel: "1A", url: "https://doi.org/10.1016/S1470-2045(19)30626-6",
      tags: ["食管癌", "鳞癌", "纳武利尤单抗", "二线治疗", "免疫治疗", "ATTRACTION-3"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "RATIONALE-302：替雷利珠单抗二线治疗晚期食管鳞癌III期研究",
      titleEn: "RATIONALE-302: Tislelizumab vs Chemotherapy as Second-Line for Advanced ESCC",
      source: "Journal of Clinical Oncology", authors: "Shen L et al.", year: 2022,
      summary: "全球多中心III期RCT证实替雷利珠单抗二线治疗晚期食管鳞癌较化疗显著改善OS(8.6 vs 6.3个月,HR 0.70, P=0.0001),ORR翻倍(20.3% vs 9.8%),安全性更优。2024年3月获FDA批准。",
      keyPoints: ["全球11个国家512例晚期食管鳞癌患者,一线化疗后进展", "OS显著改善:8.6个月 vs 6.3个月(HR 0.70, P=0.0001)", "ORR提高至20.3% vs 9.8%,缓解持续时间7.1 vs 4.0个月", "≥3级治疗相关不良事件19% vs 56%", "2024年3月获FDA批准用于食管鳞癌二线治疗"],
      evidenceLevel: "1A", url: "https://doi.org/10.1200/JCO.21.01926",
      tags: ["食管癌", "鳞癌", "替雷利珠单抗", "二线治疗", "免疫治疗", "RATIONALE-302"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "ORIENT-15：信迪利单抗联合化疗一线治疗晚期食管鳞癌III期研究",
      titleEn: "ORIENT-15: Sintilimab Plus Chemotherapy as First-Line for Advanced ESCC",
      source: "BMJ", authors: "Lu Z et al.", year: 2022,
      summary: "多中心双盲III期RCT证实信迪利单抗联合化疗一线治疗晚期食管鳞癌显著改善OS(16.7 vs 12.5个月,HR 0.628)和PFS(7.2 vs 5.7个月),ORR达66.1%。信迪利单抗为国产可及性高的PD-1抑制剂,获NMPA批准。",
      keyPoints: ["659例未经治疗的晚期食管鳞癌随机分组", "中位OS:16.7个月 vs 12.5个月(HR 0.628, P<0.001)", "中位PFS:7.2个月 vs 5.7个月(HR 0.558)", "ORR:66.1% vs 45.5%", "信迪利单抗为国产PD-1抑制剂,可及性高"],
      evidenceLevel: "1A", url: "https://doi.org/10.1136/bmj-2021-068714",
      tags: ["食管癌", "鳞癌", "信迪利单抗", "一线治疗", "免疫联合化疗", "ORIENT-15"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "JUPITER-06：特瑞普利单抗联合化疗一线治疗晚期食管鳞癌III期研究",
      titleEn: "JUPITER-06: Toripalimab Plus Chemotherapy as First-Line for Advanced ESCC",
      source: "Cancer Cell", authors: "Wang ZX et al.", year: 2022,
      summary: "III期RCT证实特瑞普利单抗联合紫杉醇/顺铂一线治疗晚期食管鳞癌显著改善PFS(HR 0.58)和OS(17.0 vs 11.0个月,HR 0.58),CR率达26.7%。终分析OS持续获益(17.7 vs 12.9个月)。",
      keyPoints: ["514例初治晚期食管鳞癌患者随机分组", "中位PFS:5.7 vs 5.5个月(HR 0.58, P<0.0001)", "中期OS:17.0 vs 11.0个月(HR 0.58),为同类最优HR", "BICR评估ORR:69.3% vs 52.1%,完全缓解率达26.7%", "特瑞普利单抗为首个获美国FDA批准的中国自研PD-1"],
      evidenceLevel: "1A", url: "https://doi.org/10.1016/j.ccell.2022.02.007",
      tags: ["食管癌", "鳞癌", "特瑞普利单抗", "一线治疗", "免疫联合化疗", "JUPITER-06"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "ESCORT-NEO：卡瑞利珠单抗联合新辅助化疗治疗可切除食管鳞癌III期研究",
      titleEn: "ESCORT-NEO/NCCES01: Neoadjuvant Camrelizumab Plus Chemo for Resectable ESCC",
      source: "Nature Medicine", authors: "Qin J et al.", year: 2024,
      summary: "首个III期RCT证实新辅助卡瑞利珠单抗联合化疗显著提高可切除食管鳞癌pCR率(28.0% vs 4.7%),白蛋白紫杉醇方案最优,未增加手术并发症,开启围手术期免疫治疗新时代。",
      keyPoints: ["391例可切除局部晚期食管鳞癌按1:1:1随机分三组", "pCR率:卡瑞利珠单抗+白蛋白紫杉醇/顺铂组28.0%,远超化疗组4.7%", "白蛋白紫杉醇方案优于普通紫杉醇方案(pCR 28.0% vs 15.4%)", "添加免疫治疗未增加手术并发症发生率", "首个新辅助免疫III期阳性结果,有望改变治疗范式"],
      evidenceLevel: "1A", url: "https://doi.org/10.1038/s41591-024-03064-w",
      tags: ["食管癌", "鳞癌", "卡瑞利珠单抗", "新辅助治疗", "围手术期", "ESCORT-NEO"]
    },
    {
      cancerType: "esophageal", category: "trial",
      title: "RATIONALE-306：替雷利珠单抗联合化疗一线治疗晚期食管鳞癌全球III期研究",
      titleEn: "RATIONALE-306: Tislelizumab Plus Chemotherapy as First-Line for Advanced ESCC (Global)",
      source: "Lancet Oncology", authors: "Shen L et al.", year: 2023,
      summary: "全球多中心III期RCT,649例晚期食管鳞癌随机接受替雷利珠单抗+化疗或安慰剂+化疗。替雷利珠单抗组中位OS 17.2 vs 10.6个月(HR 0.66),PFS 7.3 vs 5.6个月(HR 0.62),ORR 63% vs 42%。获FDA批准一线食管鳞癌适应证。",
      keyPoints: ["649例晚期食管鳞癌全球多中心III期研究", "中位OS:17.2 vs 10.6个月(HR 0.66)", "中位PFS:7.3 vs 5.6个月(HR 0.62)", "ORR:63% vs 42%", "获FDA批准用于晚期食管鳞癌一线治疗"],
      evidenceLevel: "1A", url: "https://doi.org/10.1016/S1470-2045(23)00108-0",
      tags: ["食管癌", "鳞癌", "替雷利珠单抗", "一线治疗", "免疫联合化疗", "RATIONALE-306"]
    },
    // --- 新增支持治疗/患者教育 (7条) ---
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌术后疼痛管理与多模式镇痛",
      titleEn: "Postoperative Pain Management and Multimodal Analgesia After Esophagectomy",
      source: "ERAS Society / WHO", authors: "Low DE, Allum W, et al.", year: 2019,
      summary: "食管切除术后推荐以区域麻醉(硬膜外或椎旁阻滞)为基础的多模式镇痛方案,联合非阿片类药物,最大限度减少阿片类使用,促进早期下床活动和肺功能恢复。WHO阶梯镇痛原则仍为癌痛管理基本框架。",
      keyPoints: ["术后首选胸段硬膜外镇痛(TEA)或椎旁神经阻滞(PVB)", "联合PCA作为补充,按需给予阿片类处理爆发痛", "常规使用对乙酰氨基酚+NSAIDs减少阿片用量30-50%", "术后尽早评估NRS疼痛评分,目标静息≤3分", "良好镇痛是早期下床和呼吸训练的前提"],
      evidenceLevel: "1A", url: "",
      tags: ["术后镇痛", "多模式镇痛", "硬膜外镇痛", "ERAS", "WHO阶梯镇痛"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌免疫治疗相关不良反应(irAE)识别与管理",
      titleEn: "Management of Immune-Related Adverse Events (irAEs) in Esophageal Cancer",
      source: "NCCN/CSCO/ESMO", authors: "Thompson JA, et al.", year: 2024,
      summary: "食管癌免疫治疗常见irAE包括皮肤毒性(最常见)、甲状腺功能异常(8-22%)、免疫性肺炎和肝炎。G1可继续用药;G2暂停免疫治疗并考虑激素;G3启用泼尼松1-2mg/kg/d;G4永久停药。患者需掌握自我监测要点。",
      keyPoints: ["皮肤毒性最常见:G1-2外用激素,G3口服泼尼松并暂停治疗", "甲状腺毒性8-22%:先甲亢后甲减,甲减需长期左甲状腺素替代", "免疫性肺炎(3-5%):任何级别暂停免疫治疗,G2予激素", "患者自监:关注皮疹、乏力怕冷、干咳气短、黄疸食欲下降", "每次免疫治疗前常规查甲功和肝功"],
      evidenceLevel: "2A", url: "",
      tags: ["免疫治疗", "irAE", "免疫相关不良反应", "PD-1抑制剂", "甲状腺毒性"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌化疗所致恶心呕吐(CINV)预防方案",
      titleEn: "Prevention of CINV in Esophageal Cancer",
      source: "MASCC/ESMO", authors: "Herrstedt J, et al.", year: 2023,
      summary: "食管癌常用含顺铂方案属高致吐风险(HEC),推荐四药联合预防:5-HT3受体拮抗剂+NK1受体拮抗剂+地塞米松+奥氮平。含紫杉醇方案属中致吐风险(MEC),推荐二药方案。化疗前30-60分钟服用止吐药。",
      keyPoints: ["顺铂方案(≥50mg/m²)属高致吐风险,推荐四药预防", "D1:帕洛诺司琼+阿瑞匹坦+地塞米松+奥氮平5mg", "延迟期(D2-4):地塞米松+阿瑞匹坦+奥氮平", "奥氮平5mg与10mg疗效相当且嗜睡更少,推荐低剂量", "患者教育:化疗前30-60分钟服止吐药,少量多餐避油腻"],
      evidenceLevel: "1A", url: "",
      tags: ["CINV", "化疗致吐", "止吐", "顺铂", "MASCC", "奥氮平"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "食管癌早期筛查与早诊早治(中国方案)",
      titleEn: "Early Detection and Screening of Esophageal Cancer in China",
      source: "国家卫生健康委", authors: "赫捷, 陈万青, 李兆申 等", year: 2024,
      summary: "针对45-74岁高危人群(高发区居住、一级亲属史、不良生活习惯)推荐内镜筛查。白光内镜结合碘染色为基本方法,NBI和AI辅助内镜可提高早期癌检出率。高风险人群每5年1次内镜,有低级别上皮内瘤变者缩短至1-3年。",
      keyPoints: ["高危标准:≥45岁+高发区/亲属史/热烫饮食/吸烟饮酒", "筛查方法:白光内镜+碘染色为基础,NBI精查可疑病变", "AI辅助内镜可将病变遗漏率从6.7%降至1.7%", "高风险人群每5年1次内镜,有病变者每1-3年1次", "预防:戒烟限酒、避免>65°C饮食、减少腌制食品"],
      evidenceLevel: "2A", url: "",
      tags: ["食管癌筛查", "早诊早治", "高危人群", "内镜检查", "碘染色", "AI辅助"]
    },
    {
      cancerType: "esophageal", category: "rehabilitation",
      title: "食管癌术后运动与体力活动指南",
      titleEn: "Postoperative Exercise Guidelines for Esophageal Cancer Survivors",
      source: "ACSM", authors: "Campbell KL, et al.", year: 2025,
      summary: "ACSM推荐癌症幸存者每周≥150分钟中等强度有氧运动+每周2次抗阻训练。食管癌术后运动康复应在出院4周后开始,个体化制定运动处方。PERFECT试验证实术后12周运动可改善生活质量和体能。",
      keyPoints: ["每周≥150分钟中等强度有氧运动(快走、骑车)", "每周≥2次抗阻训练(2组x12-15次)", "术后第1天即鼓励床边活动,出院后4周开始系统运动", "禁忌:活动性感染、未愈合吻合口漏、严重贫血(Hb<8g/dL)", "≥65岁额外推荐每周≥3天平衡训练降低跌倒风险"],
      evidenceLevel: "2A", url: "",
      tags: ["运动康复", "体力活动", "ACSM", "有氧运动", "抗阻训练", "癌症幸存者"]
    },
    {
      cancerType: "esophageal", category: "nutrition",
      title: "食管癌术后倾倒综合征识别与管理",
      titleEn: "Dumping Syndrome Recognition and Management After Esophagectomy",
      source: "Nature Reviews Endocrinology", authors: "Scarpellini E, et al.", year: 2020,
      summary: "食管切除术后倾倒综合征发生率约50%。早期倾倒(餐后0-60分钟)因高渗食糜致血容量下降;晚期倾倒(餐后1-3小时)因过度胰岛素分泌致低血糖。饮食调整为一线治疗,药物包括阿卡波糖和生长抑素类似物。",
      keyPoints: ["早期倾倒(餐后0-60分钟):腹胀腹痛腹泻、心悸出汗头晕", "晚期倾倒(餐后1-3小时):低血糖——出冷汗、手抖、心慌", "一线治疗:少量多餐、高蛋白高纤维、避免单糖和精制碳水", "进餐时不饮水,饮水应在餐前/餐后30-60分钟", "晚期倾倒可用阿卡波糖50-100mg随餐口服"],
      evidenceLevel: "2A", url: "https://doi.org/10.1038/s41574-020-0357-5",
      tags: ["倾倒综合征", "术后并发症", "饮食管理", "低血糖", "阿卡波糖"]
    },
    {
      cancerType: "esophageal", category: "guideline",
      title: "化疗患者PICC导管与输液港日常维护指南",
      titleEn: "PICC Line and Implanted Port Care Guidelines for Chemotherapy Patients",
      source: "INS 9th Edition / WS/T 433-2023", authors: "Gorski LA, et al.", year: 2024,
      summary: "化疗患者中心静脉通路以PICC和输液港(PORT)为主。PICC需每周维护1次(冲封管+换敷料),输液港治疗间歇期每4周维护1次。透明敷料每7天更换,含氯己定敷料可降低导管相关血流感染。患者需掌握血栓、感染预警信号。",
      keyPoints: ["PICC每7天冲封管1次(10mL生理盐水脉冲式)", "透明敷料每7天更换,潮湿松脱时随时换", "血栓预警:置管侧手臂肿胀疼痛发紫、回抽无回血", "感染预警:穿刺点红肿有脓性分泌物、体温>38°C", "避免置管侧提重物(>3kg)和剧烈运动"],
      evidenceLevel: "2A", url: "",
      tags: ["PICC", "输液港", "导管维护", "血栓", "感染", "化疗"]
    }
  ];

  for (const e of entries) {
    run(db, `INSERT INTO knowledge_entries (cancer_type, category, title, title_en, source, authors, year, summary, key_points_json, evidence_level, url, tags_json)
             VALUES (:cancerType, :category, :title, :titleEn, :source, :authors, :year, :summary, :keyPointsJson, :evidenceLevel, :url, :tagsJson)`, {
      cancerType: e.cancerType, category: e.category, title: e.title, titleEn: e.titleEn,
      source: e.source, authors: e.authors, year: e.year, summary: e.summary,
      keyPointsJson: toJson(e.keyPoints), evidenceLevel: e.evidenceLevel,
      url: e.url, tagsJson: toJson(e.tags)
    });
  }
}

function ensureMigrations(db) {
  try { db.exec("ALTER TABLE patients ADD COLUMN cancer_type TEXT NOT NULL DEFAULT 'esophageal'"); } catch { /* column already exists */ }
  try { db.exec("ALTER TABLE works ADD COLUMN view_token TEXT"); } catch { /* column already exists */ }
  try { db.exec("ALTER TABLE works ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0"); } catch { /* column already exists */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_works_view_token ON works(view_token)"); } catch {}
}

function seedClinicalDefaults(db) {
  const existing = get(db, "SELECT id FROM clinical_defaults LIMIT 1");
  if (existing) return;

  const defaults = [
    // --- Chinese ---
    {
      cancerType: "esophageal", category: "nutrition", language: "zh-CN",
      mustDo: ["术后遵医嘱分阶段过渡饮食", "坚持少量多餐每日6-8次", "保证高蛋白高热量摄入", "每周监测体重并记录", "进食时保持坐位或半卧位"],
      mustAvoid: ["禁食过硬过烫刺激性食物", "避免餐后立即平卧", "切勿自行断停肠内营养", "禁止饮酒及碳酸饮料"],
      redFlags: ["进食后反复呕吐无法进食", "体重两周内下降超过3公斤", "吞咽时剧烈胸痛或发热"],
      faq: [{ q: "术后多久能正常吃饭？", a: "一般需3-6个月逐步过渡，从流食到半流食再到软食。" }, { q: "需要吃营养补充剂吗？", a: "建议在医生指导下补充口服营养补充剂(ONS)。" }, { q: "出现倾倒综合征怎么办？", a: "减少单次进食量并避免高糖食物，及时告知医生。" }]
    },
    {
      cancerType: "esophageal", category: "rehabilitation", language: "zh-CN",
      mustDo: ["术后尽早下床活动", "每日进行深呼吸及咳嗽训练", "遵医嘱进行吞咽功能训练", "保持适度有氧运动如散步", "主动寻求心理支持与疏导"],
      mustAvoid: ["避免术后长期卧床不动", "禁止未经评估的剧烈运动", "切勿忽视吞咽困难症状"],
      redFlags: ["活动后严重气促或胸痛", "吞咽时反复呛咳或误吸", "持续情绪低落超过两周"],
      faq: [{ q: "术后什么时候可以运动？", a: "术后第1天即可下床，出院后从散步开始逐步增加。" }, { q: "吞咽训练怎么做？", a: "在康复师指导下进行空吞咽和体位调整训练。" }]
    },
    {
      cancerType: "esophageal", category: "guideline", language: "zh-CN",
      mustDo: ["术后前2年每3个月复查一次", "第3-5年每6个月复查一次", "按时完成CT及血液检查", "保留所有检查报告便于对比"],
      mustAvoid: ["切勿自行延长复查间隔", "不要忽略医生建议的检查项目", "避免仅凭自我感觉判断病情"],
      redFlags: ["复查发现肿瘤标志物持续升高", "出现新发吞咽困难或声音嘶哑", "不明原因持续疼痛或消瘦"],
      faq: [{ q: "需要随访多少年？", a: "至少5年，之后每年一次，建议终身关注健康。" }, { q: "每次随访做哪些检查？", a: "通常包括体检、血液检查、胸腹CT；内镜按医嘱安排。" }]
    },
    {
      cancerType: "esophageal", category: "regimen", language: "zh-CN",
      mustDo: ["化疗前后按时检查血常规", "严格遵医嘱服用止吐药物", "每日监测体温并记录", "保持口腔清洁预防口腔炎", "及时向医生报告副作用"],
      mustAvoid: ["禁止自行调整药物剂量", "化疗期间避免接触感染源", "切勿隐瞒不适症状不报告"],
      redFlags: ["体温超过38°C或伴寒战", "出血不止或皮肤大面积瘀斑", "严重腹泻或呕吐致无法进食", "手脚严重麻木影响日常活动"],
      faq: [{ q: "化疗后白细胞低怎么办？", a: "遵医嘱注射升白针，注意防护避免感染。" }, { q: "恶心呕吐如何缓解？", a: "按时服用止吐药，少量多餐，避免油腻食物。" }]
    },
    {
      cancerType: "esophageal", category: "staging", language: "zh-CN",
      mustDo: ["了解自己的病理分期报告", "向医生确认TNM各代表什么", "理解分期对治疗方案的影响", "保存完整的病理报告原件"],
      mustAvoid: ["勿仅凭网络信息自行判断预后", "避免与其他患者直接比较分期", "切勿因分期结果放弃治疗"],
      redFlags: ["病理报告结果与临床不一致", "分期评估后出现新发症状"],
      faq: [{ q: "TNM分期是什么意思？", a: "T代表肿瘤深度，N代表淋巴结转移，M代表远处转移。" }, { q: "分期能决定能不能治好吗？", a: "分期是制定方案的依据，但不能完全决定预后。" }]
    },
    {
      cancerType: "esophageal", category: "trial", language: "zh-CN",
      mustDo: ["充分阅读并理解知情同意书", "了解试验目的及可能的风险", "知晓可随时无条件退出试验", "按方案要求完成随访和检查"],
      mustAvoid: ["未签知情同意书前不要入组", "不要隐瞒既往病史和用药情况", "切勿自行合并使用其他药物"],
      redFlags: ["试验期间出现严重不良反应", "感觉权益受损或被施压参与"],
      faq: [{ q: "参加临床试验安全吗？", a: "经伦理审批有严格监管，可随时退出，权益受法律保护。" }, { q: "如果分到对照组怎么办？", a: "对照组也接受当前标准治疗，不会用安慰剂替代。" }]
    },
    // --- English ---
    {
      cancerType: "esophageal", category: "nutrition", language: "en",
      mustDo: ["Progress diet in stages per doctor's orders", "Eat small frequent meals, 6-8 times daily", "Ensure high-protein, high-calorie intake", "Monitor and record weight weekly", "Stay upright while eating"],
      mustAvoid: ["Avoid hard, very hot, or irritating foods", "Do not lie flat immediately after meals", "Never stop enteral nutrition without advice", "No alcohol or carbonated beverages"],
      redFlags: ["Repeated vomiting and inability to eat", "Weight loss over 3kg in two weeks", "Severe chest pain or fever when swallowing"],
      faq: [{ q: "When can I eat normally after surgery?", a: "Usually 3-6 months, progressing from liquids to soft foods." }, { q: "Do I need nutritional supplements?", a: "Oral nutritional supplements (ONS) are recommended under guidance." }]
    },
    {
      cancerType: "esophageal", category: "rehabilitation", language: "en",
      mustDo: ["Get out of bed as early as possible post-op", "Practice deep breathing and coughing daily", "Follow prescribed swallowing rehab exercises", "Maintain light aerobic activity like walking", "Actively seek psychological support"],
      mustAvoid: ["Avoid prolonged bed rest after surgery", "No vigorous exercise without assessment", "Do not ignore swallowing difficulties"],
      redFlags: ["Severe breathlessness or chest pain on activity", "Repeated choking or aspiration when swallowing", "Persistent low mood lasting over two weeks"],
      faq: [{ q: "When can I start exercising?", a: "Assisted mobilization from day 1; systematic exercise from 4 weeks post-discharge." }, { q: "How do I practice swallowing rehab?", a: "Under therapist guidance: dry swallows and postural adjustments." }]
    },
    {
      cancerType: "esophageal", category: "guideline", language: "en",
      mustDo: ["Follow up every 3 months for the first 2 years", "Follow up every 6 months for years 3-5", "Complete CT scans and blood tests on schedule", "Keep all test reports for comparison"],
      mustAvoid: ["Never extend follow-up intervals on your own", "Do not skip doctor-recommended tests", "Avoid judging condition by symptoms alone"],
      redFlags: ["Tumor markers rising on consecutive tests", "New-onset dysphagia or hoarseness", "Unexplained persistent pain or weight loss"],
      faq: [{ q: "How many years of follow-up?", a: "At least 5 years, then annual. Lifelong awareness advised." }, { q: "What tests at each visit?", a: "Physical exam, blood work, chest/abdominal CT; endoscopy as indicated." }]
    },
    {
      cancerType: "esophageal", category: "regimen", language: "en",
      mustDo: ["Get blood counts checked before and after chemo", "Take anti-nausea meds exactly as prescribed", "Monitor and record body temperature daily", "Maintain oral hygiene to prevent mucositis", "Report side effects promptly"],
      mustAvoid: ["Never adjust drug doses on your own", "Avoid infection exposure during chemo", "Do not hide or delay reporting symptoms"],
      redFlags: ["Fever above 38°C or chills", "Uncontrolled bleeding or large bruises", "Severe diarrhea/vomiting preventing eating", "Severe numbness affecting daily function"],
      faq: [{ q: "What if my white blood cells are low?", a: "G-CSF injections as prescribed; take infection precautions." }, { q: "How can I manage nausea?", a: "Take antiemetics on schedule, eat small frequent meals, avoid greasy foods." }]
    },
    {
      cancerType: "esophageal", category: "staging", language: "en",
      mustDo: ["Learn and understand your pathology staging", "Ask your doctor what T, N, M each means", "Understand how staging affects treatment", "Keep original copies of pathology reports"],
      mustAvoid: ["Do not self-interpret prognosis from the internet", "Avoid comparing staging with other patients", "Never give up treatment based on staging alone"],
      redFlags: ["Pathology inconsistent with clinical findings", "New symptoms after staging workup"],
      faq: [{ q: "What does TNM staging mean?", a: "T = tumor depth, N = lymph node involvement, M = distant metastasis." }, { q: "Does staging determine if I can be cured?", a: "Staging guides treatment but does not solely determine outcome." }]
    },
    {
      cancerType: "esophageal", category: "trial", language: "en",
      mustDo: ["Read and fully understand informed consent", "Know the trial purpose and possible risks", "Know you can withdraw at any time freely", "Complete all follow-up visits per protocol"],
      mustAvoid: ["Do not enroll before signing informed consent", "Do not conceal medical history or medications", "Never take other drugs without telling the team"],
      redFlags: ["Severe adverse reactions during the trial", "Feeling pressured or rights being violated"],
      faq: [{ q: "Is it safe to join a clinical trial?", a: "Trials are IRB-approved with strict oversight; you may withdraw anytime." }, { q: "What if I'm in the control group?", a: "Control group receives standard treatment; no placebo replaces effective therapy." }]
    }
  ];

  for (const d of defaults) {
    run(db, `INSERT INTO clinical_defaults (cancer_type, category, must_do_json, must_avoid_json, red_flags_json, faq_json, language)
             VALUES (:cancerType, :category, :mustDoJson, :mustAvoidJson, :redFlagsJson, :faqJson, :language)`, {
      cancerType: d.cancerType, category: d.category,
      mustDoJson: toJson(d.mustDo), mustAvoidJson: toJson(d.mustAvoid),
      redFlagsJson: toJson(d.redFlags), faqJson: toJson(d.faq),
      language: d.language
    });
  }
}

export function seedDatabase(db) {
  ensureMigrations(db);

  const adminId = seedUser(db, {
    username: "admin",
    displayName: "Platform Admin",
    role: "admin",
    password: "admin123"
  });

  const doctorId = seedUser(db, {
    username: "doctor",
    displayName: "黎医生",
    role: "doctor",
    password: "doctor123"
  });

  seedUser(db, {
    username: "reviewer",
    displayName: "王主任(审核专家)",
    role: "doctor",
    password: "review123"
  });

  // Seed example patients for the doctor
  seedPatients(db, doctorId);

  // Seed esophageal cancer knowledge base
  seedKnowledge(db);

  // Seed clinical action defaults (evidence-based must_do/must_avoid/red_flags per category)
  seedClinicalDefaults(db);

  const existingSchema = get(db, "SELECT id FROM schemas WHERE slug = :slug", {
    slug: "clinical-education-prescription"
  });

  const schemaId = existingSchema
    ? existingSchema.id
    : Number(
      run(
        db,
        `INSERT INTO schemas (slug, name, description, created_by)
         VALUES (:slug, :name, :description, :createdBy)`,
        {
          slug: "clinical-education-prescription",
          name: "Clinical Education Prescription",
          description: "Default contest schema for doctor-driven patient education bundles.",
          createdBy: adminId
        }
      ).lastInsertRowid
    );

  const versions = all(db, "SELECT id FROM schema_versions WHERE schema_id = :schemaId", { schemaId });

  if (!versions.length) {
    const versionId = Number(
      run(
        db,
        `INSERT INTO schema_versions (schema_id, version, title, definition_json, is_active, created_by, activated_at)
         VALUES (:schemaId, 1, :title, :definitionJson, 1, :createdBy, CURRENT_TIMESTAMP)`,
        {
          schemaId,
          title: "v1",
          definitionJson: toJson(buildDefaultSchemaDefinition()),
          createdBy: adminId
        }
      ).lastInsertRowid
    );

    return { adminId, schemaId, versionId };
  }

  run(
    db,
    `UPDATE schema_versions
        SET is_active = CASE WHEN id = (
          SELECT id
            FROM schema_versions
           WHERE schema_id = :schemaId
           ORDER BY version DESC
           LIMIT 1
        ) THEN 1 ELSE 0 END
      WHERE schema_id = :schemaId`,
    { schemaId }
  );

  const activeVersion = get(
    db,
    "SELECT id FROM schema_versions WHERE schema_id = :schemaId AND is_active = 1",
    { schemaId }
  );

  return {
    adminId,
    schemaId,
    versionId: activeVersion?.id || null
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDatabase();
  const result = seedDatabase(db);
  console.log(`Seeded admin, doctor, and schema ${result.schemaId} (active version ${result.versionId}).`);
  db.close();
}
