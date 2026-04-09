/**
 * 生产入口：先加载 .env 环境变量，再启动应用。
 * 解决 ES module import 先于顶层代码执行导致 api-config.js
 * 读不到 .env 变量的问题。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

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
  console.log(`Loaded .env (${Object.keys(process.env).filter(k => k.startsWith("MEDIARK_")).length} MEDIARK_* vars)`);
}

// 现在 process.env 已就绪，再 import app
const { createApp } = await import("./app.js");
const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`MediArk server listening on http://localhost:${port}`);
  console.log(`Mode: ${process.env.MEDIARK_MODE || "未设置 (默认 mock)"}`);
});
