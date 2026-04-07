import express from "express";

import {
  activateSchemaVersion,
  createSchema,
  createSchemaVersion,
  getActiveSchemaVersion,
  getSchemaById,
  getSchemaBySlug,
  getSchemaVersionById,
  listSchemas
} from "../lib/work-service.js";

export function createSchemasRouter({ db, auth }) {
  const router = express.Router();

  router.use(auth.requireAuth);

  router.get("/", (_req, res) => {
    res.json({ items: listSchemas(db) });
  });

  router.get("/:slug/active", (req, res) => {
    const active = getActiveSchemaVersion(db, req.params.slug);

    if (!active) {
      return res.status(404).json({ error: "Active schema version not found." });
    }

    return res.json(active);
  });

  router.post("/", auth.requireRole("admin"), (req, res) => {
    const slug = String(req.body?.slug || "").trim();
    const name = String(req.body?.name || "").trim();
    const definition = req.body?.definition;

    if (!slug || !name || !definition) {
      return res.status(400).json({ error: "slug, name and definition are required." });
    }

    if (getSchemaBySlug(db, slug)) {
      return res.status(409).json({ error: "Schema already exists." });
    }

    const created = createSchema(db, {
      slug,
      name,
      description: req.body?.description || "",
      title: req.body?.title || "v1",
      definition
    }, req.auth.user.id);

    return res.status(201).json(created);
  });

  router.post("/:id/versions", auth.requireRole("admin"), (req, res) => {
    const schemaId = Number(req.params.id);
    const schema = getSchemaById(db, schemaId);

    if (!schema) {
      return res.status(404).json({ error: "Schema not found." });
    }

    if (!req.body?.definition) {
      return res.status(400).json({ error: "definition is required." });
    }

    const version = createSchemaVersion(db, schemaId, {
      title: req.body?.title || "",
      definition: req.body.definition
    }, req.auth.user.id);

    return res.status(201).json({ schema, version });
  });

  router.post("/:id/activate", auth.requireRole("admin"), (req, res) => {
    const schemaId = Number(req.params.id);
    const schema = getSchemaById(db, schemaId);

    if (!schema) {
      return res.status(404).json({ error: "Schema not found." });
    }

    const versionId = Number(req.body?.versionId);
    const version = getSchemaVersionById(db, versionId);

    if (!version || version.schemaId !== schemaId) {
      return res.status(404).json({ error: "Schema version not found." });
    }

    const activeVersion = activateSchemaVersion(db, schemaId, versionId);
    return res.json({ schema: getSchemaById(db, schemaId), version: activeVersion });
  });

  return router;
}
