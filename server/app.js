import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

// 加载 .env 文件（Node 22 无需第三方包）
const __dirnameInit = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirnameInit, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { createAuthMiddleware } from "./lib/auth.js";
import { createDatabase } from "./db.js";
import { createAuthRouter } from "./routes/auth.js";
import { createLibraryRouter } from "./routes/library.js";
import { createSchemasRouter } from "./routes/schemas.js";
import { createUsersRouter } from "./routes/users.js";
import { createPatientsRouter } from "./routes/patients.js";
import { createWorksRouter } from "./routes/works.js";
import { createKnowledgeRouter } from "./routes/knowledge.js";
import { seedDatabase } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

export function createApp({ db = createDatabase(), disableStatic = false, generationRuntime = {} } = {}) {
  seedDatabase(db);

  const app = express();
  const auth = createAuthMiddleware(db);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", createAuthRouter({ db, auth }));
  app.use("/api/users", createUsersRouter({ db, auth }));
  app.use("/api/schemas", createSchemasRouter({ db, auth }));
  app.use("/api/patients", createPatientsRouter({ db, auth }));
  app.use("/api/works", createWorksRouter({ db, auth, generationRuntime }));
  app.use("/api/library", createLibraryRouter({ db }));
  app.use("/api/knowledge", createKnowledgeRouter({ db, auth }));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  });

  if (!disableStatic) {
    app.use(express.static(PROJECT_ROOT));
    app.get("/", (_req, res) => {
      res.sendFile(path.join(PROJECT_ROOT, "index.html"));
    });
  }

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`MediArk server listening on http://localhost:${port}`);
  });
}
