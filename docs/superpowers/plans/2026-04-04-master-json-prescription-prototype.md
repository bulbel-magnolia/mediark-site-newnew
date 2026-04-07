# Master JSON Prescription Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the prescription workflow into a `master.json` driven multi-modal prototype with poster preview, provider config placeholders, and a safe mock mode.

**Architecture:** Keep the site static and move prescription logic out of the inline script into small ES modules. Use a pure-data pipeline: form input and evidence bundle create a `master.json`, then derived helpers build poster, image, video, and audio payloads. Default to mock mode so the demo works without live API keys; live providers are wired through empty config placeholders only.

**Tech Stack:** Static HTML, browser ES modules, Tailwind CDN, Node built-in test runner.

---

### File Map

**Create**
- `js/config/api-config.example.js`
- `js/prescription/master-schema.js`
- `js/prescription/mock-data.js`
- `js/prescription/pipeline.js`
- `js/prescription/poster-renderer.js`
- `js/prescription/ui-state.js`
- `js/prescription/app.js`
- `tests/prescription/master-schema.test.js`
- `tests/prescription/poster-renderer.test.js`

**Modify**
- `prescription.html`

### Task 1: Add failing tests for pure data transforms

**Files:**
- Create: `tests/prescription/master-schema.test.js`
- Create: `tests/prescription/poster-renderer.test.js`
- Test: `node --test tests/prescription/*.test.js`

- [ ] Write a failing test that verifies `buildMasterJson()` returns the expected top-level sections and keeps poster text within slot limits.
- [ ] Run `node --test tests/prescription/master-schema.test.js` and confirm failure because the module does not exist yet.
- [ ] Write a failing test that verifies `buildPosterPayload()` maps `poster_spec` and artifact URLs into render-ready cards.
- [ ] Run `node --test tests/prescription/poster-renderer.test.js` and confirm failure because the module does not exist yet.

### Task 2: Implement the schema and poster helpers

**Files:**
- Create: `js/prescription/master-schema.js`
- Create: `js/prescription/poster-renderer.js`
- Modify: `tests/prescription/master-schema.test.js`
- Modify: `tests/prescription/poster-renderer.test.js`

- [ ] Implement `buildMasterJson(formInput, patient, evidence, options)` as a pure function that returns `meta`, `status`, `spec`, `artifacts`, and `review`.
- [ ] Implement `clampPosterText(value, limit)` and use it inside `buildMasterJson()` for `poster_spec`.
- [ ] Implement `buildPosterPayload(masterJson)` as a pure function that returns `title`, `subtitle`, `heroImage`, `keyPoints`, `doList`, `dontList`, `redFlags`, and footer metadata.
- [ ] Re-run `node --test tests/prescription/*.test.js` and confirm both tests pass.

### Task 3: Add mock/live pipeline modules and provider registry placeholders

**Files:**
- Create: `js/config/api-config.example.js`
- Create: `js/prescription/mock-data.js`
- Create: `js/prescription/pipeline.js`
- Create: `js/prescription/ui-state.js`

- [ ] Add a provider registry with empty values for `text_master`, `text_reviewer`, `image_main`, `video_main`, and `audio_main`.
- [ ] Add mock patient, evidence, and artifact data that produces a complete `master.json` and visible poster/video cards with current repo assets.
- [ ] Implement a pipeline facade that supports `mock` mode now and exposes `generateMasterJson()`, `requestImageAssets()`, `requestVideoAssets()`, and `requestAudioAssets()` hooks for future live mode.
- [ ] Implement a small UI state store for current step, active patient, generated `masterJson`, and derived poster payload.

### Task 4: Refactor the prescription page to use modules

**Files:**
- Modify: `prescription.html`
- Create: `js/prescription/app.js`

- [ ] Replace the inline script with a module entrypoint.
- [ ] Keep the existing three-step flow but change step 2 into a JSON-driven review screen with:
- [ ] `master.json` summary card
- [ ] raw JSON preview block
- [ ] poster preview panel
- [ ] image/video/audio artifact status cards
- [ ] doctor review note and regenerate action
- [ ] Change step 3 into a deliverables screen that surfaces poster, JSON, and media outputs instead of a generic success-only card.

### Task 5: Verify

**Files:**
- Test: `node --test tests/prescription/*.test.js`
- Manual: `prescription.html`

- [ ] Run `node --test tests/prescription/*.test.js` and confirm success.
- [ ] Open `prescription.html` manually and verify:
- [ ] Step 1 still loads patient info.
- [ ] Step 2 generates a `master.json` preview in mock mode.
- [ ] Poster preview renders using `poster_spec`.
- [ ] Asset cards show placeholder provider/model labels and current output status.
- [ ] Step 3 shows deliverables without requiring real keys.
