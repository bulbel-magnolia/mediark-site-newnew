PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schemas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_id INTEGER NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  UNIQUE(schema_id, version)
);

CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_id INTEGER NOT NULL REFERENCES schemas(id),
  schema_version_id INTEGER NOT NULL REFERENCES schema_versions(id),
  title TEXT NOT NULL,
  topic TEXT,
  format TEXT,
  audience TEXT,
  status TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  assigned_reviewer_id INTEGER REFERENCES users(id),
  published_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  input_json TEXT NOT NULL,
  master_json TEXT NOT NULL,
  poster_payload TEXT NOT NULL,
  diagnostics_json TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, version)
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_version_id INTEGER NOT NULL REFERENCES work_versions(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT,
  url TEXT,
  thumbnail_url TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  diagnosis TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_creator ON patients(created_by);

CREATE TABLE IF NOT EXISTS generation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  work_version_id INTEGER NOT NULL REFERENCES work_versions(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  diagnostics_json TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS review_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  work_version_id INTEGER REFERENCES work_versions(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  note TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_schema_versions_active ON schema_versions(schema_id, is_active);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
CREATE INDEX IF NOT EXISTS idx_works_reviewer ON works(assigned_reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_work_versions_work_id ON work_versions(work_id, version);
CREATE INDEX IF NOT EXISTS idx_assets_work_version_id ON assets(work_version_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_work_id ON review_actions(work_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cancer_type TEXT NOT NULL DEFAULT 'esophageal',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  authors TEXT NOT NULL DEFAULT '',
  year INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  key_points_json TEXT NOT NULL DEFAULT '[]',
  evidence_level TEXT,
  url TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_cancer_type ON knowledge_entries(cancer_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);
