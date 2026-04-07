import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createAuthMiddleware } from "./lib/auth.js";
import { createDatabase } from "./db.js";
import { createAuthRouter } from "./routes/auth.js";
import { createLibraryRouter } from "./routes/library.js";
import { createSchemasRouter } from "./routes/schemas.js";
import { createUsersRouter } from "./routes/users.js";
import { createWorksRouter } from "./routes/works.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

export function createApp({ db = createDatabase(), disableStatic = false, generationRuntime = {} } = {}) {
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
  app.use("/api/works", createWorksRouter({ db, auth, generationRuntime }));
  app.use("/api/library", createLibraryRouter({ db }));

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
