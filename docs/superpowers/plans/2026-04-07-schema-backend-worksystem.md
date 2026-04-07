# Schema Backend Worksystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Node.js + SQLite backend with role-based auth, dynamic schema-driven generation inputs, review workflow, and a managed published-works library for the existing MediArk frontend.

**Architecture:** Keep the current static HTML pages as the UI shell, add an Express API server under `server/`, and move auth, schema config, works, review actions, and public library indexing into SQLite. Reuse the existing generation pipeline modules on the server so generated `master.json`, poster payloads, and asset metadata are persisted as versioned records instead of staying browser-local.

**Tech Stack:** Node.js, Express, SQLite, built-in fetch, existing frontend HTML/Tailwind pages, existing `js/prescription/*` modules

---

### Task 1: Backend Foundation

**Files:**
- Create: `server/app.js`
- Create: `server/db.js`
- Create: `server/schema.sql`
- Create: `server/seed.js`
- Modify: `package.json`

- [ ] Add backend dependencies and `server:*` scripts to `package.json`.
- [ ] Create SQLite bootstrap in `server/db.js` with schema initialization on startup.
- [ ] Create `server/schema.sql` with tables: `users`, `sessions`, `schemas`, `schema_versions`, `works`, `work_versions`, `assets`, `generation_runs`, `review_actions`.
- [ ] Create `server/app.js` with Express setup, JSON parsing, static file serving, and route mounting.
- [ ] Create `server/seed.js` to seed one `admin`, one `doctor_reviewer`, and one active default schema.

### Task 2: Auth and Session Layer

**Files:**
- Create: `server/lib/auth.js`
- Create: `server/routes/auth.js`
- Modify: `server/app.js`
- Test: `server/tests/auth.test.js`

- [ ] Write auth tests covering login success, login failure, role lookup, and logout.
- [ ] Implement password hashing/verification helpers and signed cookie or token-backed session storage.
- [ ] Add `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me`.
- [ ] Add middleware for `requireAuth` and `requireRole`.

### Task 3: Schema and Work APIs

**Files:**
- Create: `server/routes/schemas.js`
- Create: `server/routes/works.js`
- Create: `server/routes/library.js`
- Create: `server/lib/work-service.js`
- Test: `server/tests/schemas.test.js`
- Test: `server/tests/works.test.js`

- [ ] Add schema APIs for listing schemas, reading the active version, creating versions, and activating a version.
- [ ] Add work APIs for list/detail/create-generate/regenerate/submit-review/review/publish/archive.
- [ ] Add public library API exposing only `published` works with cover/media metadata.
- [ ] Persist versioned `input_json`, `master_json`, `poster_payload`, asset records, and review actions.

### Task 4: Server-side Generation Integration

**Files:**
- Create: `server/lib/generate-work.js`
- Modify: `js/prescription/pipeline.js`
- Modify: `js/prescription/master-schema.js`
- Test: `server/tests/generate-work.test.js`

- [ ] Refactor the existing generation pipeline to accept schema-driven inputs in addition to the current hard-coded topics.
- [ ] Add a server-side generation wrapper that calls the existing pipeline and stores output into `works`, `work_versions`, `assets`, and `generation_runs`.
- [ ] Preserve graceful fallback when text generation fails, but persist the failure reason in `generation_runs`.
- [ ] Ensure the generation result is reusable by both admin and reviewer pages.

### Task 5: Login and Role-aware Frontend Wiring

**Files:**
- Create: `js/app/api.js`
- Create: `js/app/auth-client.js`
- Modify: `Login.html`
- Modify: `Admin.html`
- Modify: `dashboard.html`

- [ ] Replace localStorage-only login with real `/api/auth/login`.
- [ ] Add a shared frontend auth client that loads `/api/auth/me` and redirects based on role.
- [ ] Convert admin page from fake user list to backend-backed management console shell.
- [ ] Convert reviewer dashboard from static review cards to backend-backed review queue.

### Task 6: Dynamic Prescription Form

**Files:**
- Create: `js/prescription/schema-form.js`
- Modify: `prescription.html`
- Modify: `js/prescription/app.js`
- Test: `tests/prescription/schema-form.test.js`

- [ ] Replace hard-coded focus topic cards in `prescription.html` with a schema-driven form mount point.
- [ ] Render fields dynamically from the active schema version.
- [ ] Submit generation requests to `/api/works/generate`.
- [ ] Render returned work status, `master.json`, poster preview, and media outputs using backend data.

### Task 7: Works Management and Public Library UI

**Files:**
- Create: `js/app/admin-console.js`
- Create: `js/app/reviewer-dashboard.js`
- Create: `js/app/library-client.js`
- Modify: `Admin.html`
- Modify: `dashboard.html`
- Modify: `library.html`

- [ ] Expand admin page into a clearer multi-panel console for users, schemas, works, and publish/archive actions.
- [ ] Expand reviewer dashboard into a cleaner queue/detail review experience with status chips and asset previews.
- [ ] Replace static `works.json` loading in `library.html` with `/api/library/works`.
- [ ] Preserve the current site visual language, but improve spacing, status hierarchy, and management clarity.

### Task 8: Verification

**Files:**
- Modify: `package.json`
- Test: `tests/prescription/*.test.js`
- Test: `server/tests/*.test.js`

- [ ] Add a backend test command and keep the existing frontend prescription tests passing.
- [ ] Run backend auth/schema/work tests.
- [ ] Run the full existing prescription test suite.
- [ ] Run a smoke test that seeds the DB, logs in, creates a generated work, reviews it, and fetches it from the public library API.

