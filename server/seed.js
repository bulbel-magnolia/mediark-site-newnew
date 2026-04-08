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
      diagnosis: "食管鳞癌",
      stage: "术后第1周",
      tags: [
        { text: "高焦虑", category: "心理" },
        { text: "小学学历", category: "社会" },
        { text: "视觉偏好", category: "偏好" }
      ],
      notes: "患者情绪紧张，需要温和鼓励的沟通方式"
    },
    {
      name: "李淑芬",
      diagnosis: "肺腺癌",
      stage: "化疗期",
      tags: [
        { text: "情绪稳定", category: "心理" },
        { text: "方言(粤语)", category: "社会" },
        { text: "图文偏好", category: "偏好" }
      ],
      notes: "患者配合度高，家属参与度好"
    },
    {
      name: "王强",
      diagnosis: "高危人群筛查",
      stage: "早期筛查",
      tags: [
        { text: "高知群体", category: "社会" },
        { text: "关注数据", category: "偏好" }
      ],
      notes: "患者关注循证数据，偏好科学论据"
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
