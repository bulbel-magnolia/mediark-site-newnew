import { randomBytes } from "node:crypto";

import { all, fromJson, get, nowIso, run, toJson, transaction } from "../db.js";

function generateViewToken() {
  return randomBytes(12).toString("base64url");
}

function hydrateSchemaVersion(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    schemaId: row.schema_id,
    version: row.version,
    title: row.title,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    definition: fromJson(row.definition_json, {})
  };
}

function hydrateSchema(row, version = null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeVersionId: row.active_version_id || version?.id || null,
    version
  };
}

function hydrateWorkVersion(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workId: row.work_id,
    version: row.version,
    input: fromJson(row.input_json, {}),
    masterJson: fromJson(row.master_json, {}),
    posterPayload: fromJson(row.poster_payload, {}),
    diagnostics: fromJson(row.diagnostics_json, []),
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function flattenAssetGroups(artifacts = {}) {
  return [
    ...(artifacts.images || []).map((item) => ({ ...item, assetType: "image" })),
    ...(artifacts.videos || []).map((item) => ({ ...item, assetType: "video" })),
    ...(artifacts.audio || []).map((item) => ({ ...item, assetType: "audio" }))
  ];
}

function hydrateAsset(row) {
  return {
    id: row.id,
    assetKey: row.asset_key,
    assetType: row.asset_type,
    provider: row.provider,
    model: row.model,
    status: row.status,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    payload: fromJson(row.payload_json, {})
  };
}

function hydrateReview(row) {
  return {
    id: row.id,
    workId: row.work_id,
    workVersionId: row.work_version_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    action: row.action,
    note: row.note,
    payload: fromJson(row.payload_json, {}),
    createdAt: row.created_at
  };
}

export function listUsers(db) {
  return all(
    db,
    `SELECT id, username, display_name, role, is_active, created_at, updated_at
       FROM users
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, username`
  ).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export function getUserById(db, id) {
  const row = get(db, "SELECT id, username, display_name, role, is_active FROM users WHERE id = :id", { id });
  return row
    ? {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      isActive: Boolean(row.is_active)
    }
    : null;
}

export function listSchemas(db) {
  return all(
    db,
    `SELECT schemas.*,
            active.id AS active_version_id
       FROM schemas
       LEFT JOIN schema_versions AS active
         ON active.schema_id = schemas.id AND active.is_active = 1
      ORDER BY schemas.updated_at DESC`
  ).map((row) => hydrateSchema(row));
}

export function getSchemaById(db, schemaId) {
  const row = get(
    db,
    `SELECT schemas.*,
            active.id AS active_version_id
       FROM schemas
       LEFT JOIN schema_versions AS active
         ON active.schema_id = schemas.id AND active.is_active = 1
      WHERE schemas.id = :schemaId`,
    { schemaId }
  );
  return hydrateSchema(row);
}

export function getSchemaBySlug(db, slug) {
  const row = get(
    db,
    `SELECT schemas.*,
            active.id AS active_version_id
       FROM schemas
       LEFT JOIN schema_versions AS active
         ON active.schema_id = schemas.id AND active.is_active = 1
      WHERE schemas.slug = :slug`,
    { slug }
  );
  return hydrateSchema(row);
}

export function getSchemaVersionById(db, versionId) {
  return hydrateSchemaVersion(
    get(db, "SELECT * FROM schema_versions WHERE id = :versionId", { versionId })
  );
}

export function getActiveSchemaVersion(db, slug) {
  const row = get(
    db,
    `SELECT schemas.id AS schema_id,
            schemas.slug,
            schemas.name,
            schemas.description,
            schemas.created_at AS schema_created_at,
            schemas.updated_at AS schema_updated_at,
            schema_versions.id,
            schema_versions.version,
            schema_versions.title,
            schema_versions.definition_json,
            schema_versions.is_active,
            schema_versions.created_at,
            schema_versions.activated_at
       FROM schemas
       JOIN schema_versions
         ON schema_versions.schema_id = schemas.id
        AND schema_versions.is_active = 1
      WHERE schemas.slug = :slug`,
    { slug }
  );

  if (!row) {
    return null;
  }

  return {
    schema: {
      id: row.schema_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      createdAt: row.schema_created_at,
      updatedAt: row.schema_updated_at,
      activeVersionId: row.id
    },
    version: hydrateSchemaVersion(row)
  };
}

export const createSchema = transaction(function createSchemaTx(db, input, createdBy) {
  const schemaInsert = run(
    db,
    `INSERT INTO schemas (slug, name, description, created_by)
     VALUES (:slug, :name, :description, :createdBy)`,
    {
      slug: input.slug,
      name: input.name,
      description: input.description || "",
      createdBy
    }
  );

  const schemaId = Number(schemaInsert.lastInsertRowid);

  const versionInsert = run(
    db,
    `INSERT INTO schema_versions (schema_id, version, title, definition_json, is_active, created_by, activated_at)
     VALUES (:schemaId, 1, :title, :definitionJson, 1, :createdBy, :activatedAt)`,
    {
      schemaId,
      title: input.title || "v1",
      definitionJson: toJson(input.definition),
      createdBy,
      activatedAt: nowIso()
    }
  );

  return {
    schema: getSchemaById(db, schemaId),
    version: getSchemaVersionById(db, Number(versionInsert.lastInsertRowid))
  };
});

export const createSchemaVersion = transaction(function createSchemaVersionTx(db, schemaId, input, createdBy) {
  const latest = get(
    db,
    "SELECT COALESCE(MAX(version), 0) AS version FROM schema_versions WHERE schema_id = :schemaId",
    { schemaId }
  );

  const nextVersion = Number(latest?.version || 0) + 1;
  const insert = run(
    db,
    `INSERT INTO schema_versions (schema_id, version, title, definition_json, is_active, created_by)
     VALUES (:schemaId, :version, :title, :definitionJson, 0, :createdBy)`,
    {
      schemaId,
      version: nextVersion,
      title: input.title || `v${nextVersion}`,
      definitionJson: toJson(input.definition),
      createdBy
    }
  );

  run(db, "UPDATE schemas SET updated_at = CURRENT_TIMESTAMP WHERE id = :schemaId", { schemaId });
  return getSchemaVersionById(db, Number(insert.lastInsertRowid));
});

export const activateSchemaVersion = transaction(function activateSchemaVersionTx(db, schemaId, versionId) {
  run(
    db,
    `UPDATE schema_versions
        SET is_active = CASE WHEN id = :versionId THEN 1 ELSE 0 END,
            activated_at = CASE WHEN id = :versionId THEN :activatedAt ELSE activated_at END
      WHERE schema_id = :schemaId`,
    {
      schemaId,
      versionId,
      activatedAt: nowIso()
    }
  );

  run(db, "UPDATE schemas SET updated_at = CURRENT_TIMESTAMP WHERE id = :schemaId", { schemaId });
  return getSchemaVersionById(db, versionId);
});

function getLatestWorkVersionRow(db, workId) {
  return get(
    db,
    `SELECT *
       FROM work_versions
      WHERE work_id = :workId
      ORDER BY version DESC
      LIMIT 1`,
    { workId }
  );
}

function getAssetsByWorkVersionId(db, workVersionId) {
  return all(
    db,
    `SELECT *
       FROM assets
      WHERE work_version_id = :workVersionId
      ORDER BY id`,
    { workVersionId }
  ).map(hydrateAsset);
}

function getReviewActions(db, workId) {
  return all(
    db,
    `SELECT review_actions.*,
            users.display_name AS reviewer_name
       FROM review_actions
       JOIN users ON users.id = review_actions.reviewer_id
      WHERE review_actions.work_id = :workId
      ORDER BY review_actions.created_at DESC, review_actions.id DESC`,
    { workId }
  ).map(hydrateReview);
}

function recordWorkAction(db, { workId, workVersionId = null, reviewerId, action, note = "", payload = {} }) {
  run(
    db,
    `INSERT INTO review_actions (work_id, work_version_id, reviewer_id, action, note, payload_json)
     VALUES (:workId, :workVersionId, :reviewerId, :action, :note, :payloadJson)`,
    {
      workId,
      workVersionId,
      reviewerId,
      action,
      note,
      payloadJson: toJson(payload)
    }
  );
}

function hydrateWork(db, row) {
  if (!row) {
    return null;
  }

  const latestVersionRow = getLatestWorkVersionRow(db, row.id);
  const latestVersion = hydrateWorkVersion(latestVersionRow);

  if (latestVersion) {
    latestVersion.assets = getAssetsByWorkVersionId(db, latestVersion.id);
  }

  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    format: row.format,
    audience: row.audience,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    viewToken: row.view_token || null,
    viewCount: row.view_count || 0,
    schema: {
      id: row.schema_id,
      slug: row.schema_slug,
      versionId: row.schema_version_id
    },
    createdBy: {
      id: row.created_by,
      displayName: row.created_by_name
    },
    assignedReviewer: row.assigned_reviewer_id
      ? {
        id: row.assigned_reviewer_id,
        displayName: row.assigned_reviewer_name
      }
      : null,
    latestVersion,
    reviewActions: getReviewActions(db, row.id)
  };
}

function getWorkBaseRow(db, workId) {
  return get(
    db,
    `SELECT works.*,
            schemas.slug AS schema_slug,
            creators.display_name AS created_by_name,
            reviewers.display_name AS assigned_reviewer_name
       FROM works
       JOIN schemas ON schemas.id = works.schema_id
       JOIN users AS creators ON creators.id = works.created_by
       LEFT JOIN users AS reviewers ON reviewers.id = works.assigned_reviewer_id
      WHERE works.id = :workId`,
    { workId }
  );
}

export function getWorkById(db, workId) {
  return hydrateWork(db, getWorkBaseRow(db, workId));
}

export function listWorks(db, user, filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.status) {
    conditions.push("works.status = :status");
    params.status = filters.status;
  }

  if (filters.role === "reviewer" && user?.id) {
    // Reviewer mode: show works assigned to this user for review
    conditions.push("works.assigned_reviewer_id = :reviewerId");
    params.reviewerId = user.id;
  } else if (user?.role === "doctor") {
    conditions.push("works.created_by = :createdBy");
    params.createdBy = user.id;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = all(
    db,
    `SELECT works.*,
            schemas.slug AS schema_slug,
            creators.display_name AS created_by_name,
            reviewers.display_name AS assigned_reviewer_name
       FROM works
       JOIN schemas ON schemas.id = works.schema_id
       JOIN users AS creators ON creators.id = works.created_by
       LEFT JOIN users AS reviewers ON reviewers.id = works.assigned_reviewer_id
       ${whereClause}
      ORDER BY works.updated_at DESC, works.id DESC`,
    params
  );

  return rows.map((row) => hydrateWork(db, row));
}

function insertAssets(db, workVersionId, artifacts) {
  flattenAssetGroups(artifacts).forEach((asset) => {
    run(
      db,
      `INSERT INTO assets (
         work_version_id, asset_key, asset_type, provider, model, status, url, thumbnail_url, payload_json
       ) VALUES (
         :workVersionId, :assetKey, :assetType, :provider, :model, :status, :url, :thumbnailUrl, :payloadJson
       )`,
      {
        workVersionId,
        assetKey: asset.id || asset.assetKey || `${asset.assetType}-${Date.now()}`,
        assetType: asset.assetType,
        provider: asset.provider || "",
        model: asset.model || "",
        status: asset.status || "",
        url: asset.path || asset.url || "",
        thumbnailUrl: asset.thumbnail || asset.thumbnailUrl || "",
        payloadJson: toJson(asset)
      }
    );
  });
}

function insertGenerationRun(db, workId, workVersionId, bundle, triggerType, createdBy, errorMessage = null) {
  run(
    db,
    `INSERT INTO generation_runs (
       work_id, work_version_id, trigger_type, status, mode, diagnostics_json, error_message, started_at, finished_at, created_by
     ) VALUES (
       :workId, :workVersionId, :triggerType, :status, :mode, :diagnosticsJson, :errorMessage, :startedAt, :finishedAt, :createdBy
     )`,
    {
      workId,
      workVersionId,
      triggerType,
      status: errorMessage ? "failed" : "completed",
      mode: bundle.mode,
      diagnosticsJson: toJson(bundle.diagnostics),
      errorMessage,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      createdBy
    }
  );
}

export const createGeneratedWork = transaction(function createGeneratedWorkTx(db, payload) {
  const workInsert = run(
    db,
    `INSERT INTO works (
       schema_id, schema_version_id, title, topic, format, audience, status, created_by, assigned_reviewer_id, updated_at
     ) VALUES (
       :schemaId, :schemaVersionId, :title, :topic, :format, :audience, :status, :createdBy, :assignedReviewerId, :updatedAt
     )`,
    {
      schemaId: payload.schema.id,
      schemaVersionId: payload.schemaVersion.id,
      title: payload.workMeta.title,
      topic: payload.workMeta.topic,
      format: payload.workMeta.format,
      audience: payload.workMeta.audience,
      status: "generated",
      createdBy: payload.createdBy,
      assignedReviewerId: payload.assignedReviewerId || null,
      updatedAt: nowIso()
    }
  );

  const workId = Number(workInsert.lastInsertRowid);
  const workVersionInsert = run(
    db,
    `INSERT INTO work_versions (
       work_id, version, input_json, master_json, poster_payload, diagnostics_json, created_by
     ) VALUES (
       :workId, 1, :inputJson, :masterJson, :posterPayload, :diagnosticsJson, :createdBy
     )`,
    {
      workId,
      inputJson: toJson(payload.input),
      masterJson: toJson(payload.bundle.masterJson),
      posterPayload: toJson(payload.bundle.posterPayload),
      diagnosticsJson: toJson(payload.bundle.diagnostics),
      createdBy: payload.createdBy
    }
  );

  const workVersionId = Number(workVersionInsert.lastInsertRowid);
  insertAssets(db, workVersionId, payload.bundle.masterJson.artifacts);
  insertGenerationRun(db, workId, workVersionId, payload.bundle, "generate", payload.createdBy);
  recordWorkAction(db, {
    workId,
    workVersionId,
    reviewerId: payload.createdBy,
    action: "generated",
    note: "Initial multimodal bundle created."
  });

  return getWorkById(db, workId);
});

export const appendGeneratedWorkVersion = transaction(function appendGeneratedWorkVersionTx(db, payload) {
  const latest = getLatestWorkVersionRow(db, payload.workId);
  const nextVersion = Number(latest?.version || 0) + 1;

  const workVersionInsert = run(
    db,
    `INSERT INTO work_versions (
       work_id, version, input_json, master_json, poster_payload, diagnostics_json, created_by
     ) VALUES (
       :workId, :version, :inputJson, :masterJson, :posterPayload, :diagnosticsJson, :createdBy
     )`,
    {
      workId: payload.workId,
      version: nextVersion,
      inputJson: toJson(payload.input),
      masterJson: toJson(payload.bundle.masterJson),
      posterPayload: toJson(payload.bundle.posterPayload),
      diagnosticsJson: toJson(payload.bundle.diagnostics),
      createdBy: payload.createdBy
    }
  );

  const workVersionId = Number(workVersionInsert.lastInsertRowid);
  insertAssets(db, workVersionId, payload.bundle.masterJson.artifacts);
  insertGenerationRun(db, payload.workId, workVersionId, payload.bundle, "regenerate", payload.createdBy);
  recordWorkAction(db, {
    workId: payload.workId,
    workVersionId,
    reviewerId: payload.createdBy,
    action: "regenerated",
    note: "Doctor requested another refinement pass."
  });

  run(
    db,
    `UPDATE works
        SET schema_version_id = :schemaVersionId,
            title = :title,
            topic = :topic,
            format = :format,
            audience = :audience,
            status = 'generated',
            assigned_reviewer_id = NULL,
            published_at = NULL,
            archived_at = NULL,
            updated_at = :updatedAt
      WHERE id = :workId`,
    {
      workId: payload.workId,
      schemaVersionId: payload.schemaVersion.id,
      title: payload.workMeta.title,
      topic: payload.workMeta.topic,
      format: payload.workMeta.format,
      audience: payload.workMeta.audience,
      updatedAt: nowIso()
    }
  );

  return getWorkById(db, payload.workId);
});

export const publishWork = transaction(function publishWorkTx(db, workId, actorId, note = "") {
  const latestVersion = getLatestWorkVersionRow(db, workId);

  // 首次发布时生成 view token（用于公开访问链接）
  const existing = get(db, "SELECT view_token FROM works WHERE id = :workId", { workId });
  const viewToken = existing?.view_token || generateViewToken();

  run(
    db,
    `UPDATE works
        SET status = 'published',
            view_token = :viewToken,
            published_at = :publishedAt,
            archived_at = NULL,
            updated_at = :updatedAt
      WHERE id = :workId`,
    {
      workId,
      viewToken,
      publishedAt: nowIso(),
      updatedAt: nowIso()
    }
  );

  recordWorkAction(db, {
    workId,
    workVersionId: latestVersion?.id || null,
    reviewerId: actorId,
    action: "published",
    note: note || "Doctor confirmed this version for distribution."
  });

  return getWorkById(db, workId);
});

export const reviewWork = transaction(function reviewWorkTx(db, workId, actorId, action, note = "") {
  const latestVersion = getLatestWorkVersionRow(db, workId);
  const nextStatus = action === "approve" ? "approved" : action === "changes_requested" ? "changes_requested" : null;

  if (!nextStatus) {
    return getWorkById(db, workId);
  }

  run(
    db,
    `UPDATE works
        SET status = :status,
            updated_at = :updatedAt
      WHERE id = :workId`,
    {
      workId,
      status: nextStatus,
      updatedAt: nowIso()
    }
  );

  recordWorkAction(db, {
    workId,
    workVersionId: latestVersion?.id || null,
    reviewerId: actorId,
    action,
    note: note || (action === "approve"
      ? "Clinical review approved."
      : "Changes requested during clinical review.")
  });

  return getWorkById(db, workId);
});

export const archiveWork = transaction(function archiveWorkTx(db, workId, actorId, note = "") {
  const latestVersion = getLatestWorkVersionRow(db, workId);

  run(
    db,
    `UPDATE works
        SET status = 'archived',
            archived_at = :archivedAt,
            updated_at = :updatedAt
      WHERE id = :workId`,
    {
      workId,
      archivedAt: nowIso(),
      updatedAt: nowIso()
    }
  );

  recordWorkAction(db, {
    workId,
    workVersionId: latestVersion?.id || null,
    reviewerId: actorId,
    action: "archived",
    note: note || "Doctor archived this work from the active workspace."
  });

  return getWorkById(db, workId);
});

export function listLibraryWorks(db) {
  const rows = all(
    db,
    `SELECT works.*,
            schemas.slug AS schema_slug,
            creators.display_name AS created_by_name,
            reviewers.display_name AS assigned_reviewer_name
       FROM works
       JOIN schemas ON schemas.id = works.schema_id
       JOIN users AS creators ON creators.id = works.created_by
       LEFT JOIN users AS reviewers ON reviewers.id = works.assigned_reviewer_id
      WHERE works.status = 'published'
      ORDER BY works.published_at DESC, works.updated_at DESC`
  );

  return rows.map((row) => {
    const work = hydrateWork(db, row);
    const input = work.latestVersion?.input || {};
    const cancerType = input?.patient?.cancerType || "esophageal";
    return {
      id: work.id,
      title: work.title,
      topic: work.topic,
      format: work.format,
      audience: work.audience,
      cancerType,
      publishedAt: work.publishedAt,
      createdBy: work.createdBy?.id || null,
      poster: work.latestVersion?.posterPayload || null,
      summary: work.latestVersion?.masterJson?.spec?.copy_master?.short_summary || "",
      coverImage:
        work.latestVersion?.assets.find((item) => item.assetType === "image")?.url
        || work.latestVersion?.assets.find((item) => item.assetType === "image")?.thumbnailUrl
        || "",
      assets: work.latestVersion?.assets || []
    };
  });
}
