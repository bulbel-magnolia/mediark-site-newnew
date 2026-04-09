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
    run(db, `INSERT INTO patients (name, diagnosis, stage, tags_json, notes, created_by)
             VALUES (:name, :diagnosis, :stage, :tagsJson, :notes, :createdBy)`, {
      name: p.name,
      diagnosis: p.diagnosis,
      stage: p.stage,
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

export function seedDatabase(db) {
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
