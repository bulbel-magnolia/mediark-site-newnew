import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, "data", "mediark.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

export function createDatabase({ filename = DEFAULT_DB_PATH } = {}) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function run(db, sql, params = {}) {
  return db.prepare(sql).run(params);
}

export function get(db, sql, params = {}) {
  return db.prepare(sql).get(params) || null;
}

export function all(db, sql, params = {}) {
  return db.prepare(sql).all(params);
}

export function transaction(dbOrFn, maybeFn) {
  if (typeof dbOrFn === "function" && maybeFn == null) {
    const fn = dbOrFn;
    return (db, ...args) => {
      db.exec("BEGIN");
      try {
        const result = fn(db, ...args);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    };
  }

  dbOrFn.exec("BEGIN");
  try {
    const result = maybeFn();
    dbOrFn.exec("COMMIT");
    return result;
  } catch (error) {
    dbOrFn.exec("ROLLBACK");
    throw error;
  }
}

export function toJson(value) {
  return JSON.stringify(value ?? null);
}

export function fromJson(value, fallback = null) {
  if (value == null || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function projectRoot() {
  return PROJECT_ROOT;
}
