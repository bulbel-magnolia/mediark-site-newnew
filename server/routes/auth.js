import express from "express";

import { clearSessionCookie, issueSession, revokeSession, setSessionCookie, verifyPassword } from "../lib/auth.js";

export function createAuthRouter({ db, auth }) {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!row || row.is_active !== 1 || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = issueSession(db, row.id);
    setSessionCookie(res, token);

    return res.json({
      user: {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role
      }
    });
  });

  router.post("/logout", auth.optionalAuth, (req, res) => {
    revokeSession(db, req.auth?.token);
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  router.get("/me", auth.requireAuth, (req, res) => {
    return res.json({ user: req.auth.user });
  });

  return router;
}
