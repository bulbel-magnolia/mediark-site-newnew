import crypto from "node:crypto";

import { get, nowIso, run } from "../db.js";

export const SESSION_COOKIE = "mediark_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash?.includes(":")) {
    return false;
  }

  const [salt, expectedHex] = storedHash.split(":");
  const actualHex = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actualHex, "hex"), Buffer.from(expectedHex, "hex"));
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return acc;
      }

      acc[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

export function issueSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  run(
    db,
    `INSERT INTO sessions (user_id, token_hash, expires_at, last_used_at)
     VALUES (:userId, :tokenHash, :expiresAt, :lastUsedAt)`,
    {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      lastUsedAt: nowIso()
    }
  );

  return token;
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

export function revokeSession(db, token) {
  if (!token) {
    return;
  }

  run(db, "DELETE FROM sessions WHERE token_hash = :tokenHash", {
    tokenHash: hashToken(token)
  });
}

export function authenticateRequest(db, req) {
  const cookies = getCookies(req);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const row = get(
    db,
    `SELECT sessions.id AS session_id,
            sessions.expires_at,
            users.id,
            users.username,
            users.display_name,
            users.role,
            users.is_active
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = :tokenHash`,
    { tokenHash: hashToken(token) }
  );

  if (!row || row.is_active !== 1) {
    revokeSession(db, token);
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    revokeSession(db, token);
    return null;
  }

  run(db, "UPDATE sessions SET last_used_at = :lastUsedAt WHERE id = :id", {
    lastUsedAt: nowIso(),
    id: row.session_id
  });

  return {
    token,
    sessionId: row.session_id,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role
    }
  };
}

export function createAuthMiddleware(db) {
  function requireAuth(req, res, next) {
    const auth = authenticateRequest(db, req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required." });
    }

    req.auth = auth;
    return next();
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.auth) {
        return res.status(401).json({ error: "Authentication required." });
      }

      if (!roles.includes(req.auth.user.role)) {
        return res.status(403).json({ error: "Insufficient permissions." });
      }

      return next();
    };
  }

  function optionalAuth(req, _res, next) {
    req.auth = authenticateRequest(db, req);
    next();
  }

  return {
    optionalAuth,
    requireAuth,
    requireRole
  };
}
