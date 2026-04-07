import { api, ApiError } from "../app/api.js";
import { bindLogoutButton, requireAuth } from "../app/auth-client.js";
import { renderAssets, renderJson, renderPoster, renderReviewTimeline, renderStatusPill } from "../app/renderers.js";
import { createSchemaForm } from "./schema-form.js";

const state = {
  user: null,
  schema: null,
  formController: null,
  reviewers: [],
  currentWork: null
};

function $(id) {
  return document.getElementById(id);
}

function summaryFromWork(work) {
  return work?.latestVersion?.masterJson?.spec?.copy_master?.short_summary
    || work?.latestVersion?.masterJson?.spec?.clinical_core?.clinical_summary
    || "暂无临床摘要。";
}

function setMessage(message, type = "info") {
  const node = $("prescription-message");
  node.textContent = message;
  node.className = `status-pill status-${type === "error" ? "changes_requested" : "approved"}`;
  node.style.display = message ? "inline-flex" : "none";
}

function renderSchemaMeta() {
  $("schema-name").textContent = state.schema?.schema?.name || "Schema";
  $("schema-version").textContent = `Version ${state.schema?.version?.version || "-"}`;
}

function renderReviewControls() {
  const container = $("review-controls");

  if (state.user.role !== "admin" || !state.currentWork) {
    container.innerHTML = "";
    return;
  }

  const reviewers = state.reviewers.filter((user) => user.role === "doctor-reviewer" && user.isActive);

  container.innerHTML = `
    <section class="detail-card">
      <div class="inline-actions" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 class="section-title">Review Routing</h3>
          <p class="body-muted">admin 可以分配审核并发布，但不能替代 doctor-reviewer 的医学批准。</p>
        </div>
        ${renderStatusPill(state.currentWork.status)}
      </div>
      <div class="field-row" style="margin-top: 18px;">
        <div class="field">
          <label for="reviewer-select">Doctor Reviewer</label>
          <select id="reviewer-select">
            ${reviewers.map((reviewer) => `<option value="${reviewer.id}" ${state.currentWork.assignedReviewer?.id === reviewer.id ? "selected" : ""}>${reviewer.displayName}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="review-submit-note">Routing Note</label>
          <input id="review-submit-note" type="text" placeholder="例如：请重点审读危险信号顺序。">
        </div>
      </div>
      <div class="button-row" style="margin-top: 16px;">
        <button class="button" id="submit-review-button">提交审核</button>
        <button class="button-ghost" id="regenerate-button">按当前表单重生成</button>
      </div>
    </section>
  `;

  $("submit-review-button")?.addEventListener("click", handleSubmitReview);
  $("regenerate-button")?.addEventListener("click", handleRegenerate);
}

function renderWork() {
  const work = state.currentWork;

  if (!work) {
    $("result-status").innerHTML = `<div class="empty-state">生成后的作品会在这里出现，随后可以进入审核和发布流程。</div>`;
    $("poster-slot").innerHTML = `<div class="empty-state">暂无海报预览。</div>`;
    $("assets-slot").innerHTML = `<div class="empty-state">暂无多模态资产。</div>`;
    $("json-slot").innerHTML = `<div class="empty-state">暂无 master.json。</div>`;
    $("timeline-slot").innerHTML = `<div class="empty-state">暂无审核时间线。</div>`;
    renderReviewControls();
    return;
  }

  $("result-status").innerHTML = `
    <section class="detail-card">
      <div class="inline-actions" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 class="section-title">${work.title}</h3>
          <p class="body-muted">${work.topic || "未填写主题"} · ${work.format || "poster-video"} · ${work.audience || "patient"}</p>
        </div>
        ${renderStatusPill(work.status)}
      </div>
      <p class="body-muted" style="margin-top: 16px;">${summaryFromWork(work)}</p>
    </section>
  `;

  $("poster-slot").innerHTML = renderPoster(work.latestVersion?.posterPayload);
  $("assets-slot").innerHTML = renderAssets(work.latestVersion?.assets || []);
  $("json-slot").innerHTML = renderJson(work.latestVersion?.masterJson || {});
  $("timeline-slot").innerHTML = renderReviewTimeline(work.reviewActions || []);
  renderReviewControls();
}

async function loadSchema() {
  state.schema = await api.get("/api/schemas/clinical-education-prescription/active");
  renderSchemaMeta();
  state.formController = createSchemaForm($("schema-form"), state.schema.version.definition, {
    patient: {
      diagnosis: "Breast cancer recovery",
      stage: "Adjuvant therapy"
    },
    form: {
      focusTopics: ["red flags", "medication"]
    },
    work: {
      format: "poster-video",
      audience: "patient-family"
    }
  });
}

async function loadReviewersIfNeeded() {
  if (state.user.role !== "admin") {
    return;
  }

  const result = await api.get("/api/users");
  state.reviewers = result.items;
}

async function handleGenerate(event) {
  event.preventDefault();

  try {
    setMessage("正在根据当前 schema 生成作品…");
    const input = state.formController.collectInput();
    const result = await api.post("/api/works/generate", {
      schemaSlug: state.schema.schema.slug,
      input
    });
    state.currentWork = result.work;
    renderWork();
    setMessage("作品生成完成。");
  } catch (error) {
    setMessage(error instanceof ApiError ? error.message : "生成失败。", "error");
  }
}

async function handleSubmitReview() {
  try {
    const reviewerId = Number($("reviewer-select").value);
    const note = $("review-submit-note").value.trim();
    const result = await api.post(`/api/works/${state.currentWork.id}/submit-review`, {
      reviewerId,
      note
    });
    state.currentWork = result.work;
    renderWork();
    setMessage("作品已提交给 doctor-reviewer。");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function handleRegenerate() {
  try {
    const input = state.formController.collectInput();
    const result = await api.post(`/api/works/${state.currentWork.id}/regenerate`, {
      input
    });
    state.currentWork = result.work;
    renderWork();
    setMessage("作品已重生成。");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function init() {
  state.user = await requireAuth();
  if (!state.user) return;

  $("operator-name").textContent = state.user.displayName;
  $("operator-role").textContent = state.user.role;
  bindLogoutButton($("logout-button"));
  $("generate-form").addEventListener("submit", handleGenerate);

  try {
    await Promise.all([loadSchema(), loadReviewersIfNeeded()]);
    renderWork();
  } catch (error) {
    setMessage(error instanceof ApiError ? error.message : "加载处方工作区失败。", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
