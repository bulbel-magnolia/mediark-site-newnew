import express from "express";

import { get } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import { getUserById, listUsers } from "../lib/work-service.js";

export function createUsersRouter({ db, auth }) {
  const router = express.Router();

  router.use(auth.requireAuth, auth.requireRole("admin"));

  router.get("/", (_req, res) => {
    res.json({ items: listUsers(db) });
  });

  router.post("/", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const displayName = String(req.body?.displayName || "").trim();
    const role = String(req.body?.role || "").trim();
    const password = String(req.body?.password || "");
    const isActive = req.body?.isActive === false ? 0 : 1;

    if (!username || !displayName || !role || !password) {
      return res.status(400).json({ error: "username, displayName, role and password are required." });
    }

    if (get(db, "SELECT id FROM users WHERE username = :username", { username })) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const result = db.prepare(
      `INSERT INTO users (username, display_name, role, password_hash, is_active)
       VALUES (:username, :displayName, :role, :passwordHash, :isActive)`
    ).run({
      username,
      displayName,
      role,
      passwordHash: hashPassword(password),
      isActive
    });

    return res.status(201).json({ user: getUserById(db, Number(result.lastInsertRowid)) });
  });

  router.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    const user = getUserById(db, id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    db.prepare(
      `UPDATE users
          SET display_name = COALESCE(:displayName, display_name),
              role = COALESCE(:role, role),
              is_active = COALESCE(:isActive, is_active),
              password_hash = COALESCE(:passwordHash, password_hash),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`
    ).run({
      id,
      displayName: req.body?.displayName ?? null,
      role: req.body?.role ?? null,
      isActive: typeof req.body?.isActive === "boolean" ? Number(req.body.isActive) : null,
      passwordHash: req.body?.password ? hashPassword(String(req.body.password)) : null
    });

    return res.json({ user: getUserById(db, id) });
  });

  return router;
}
