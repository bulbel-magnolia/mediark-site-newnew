import { api, ApiError } from "./api.js";
import { bindLogoutButton, requireAuth } from "./auth-client.js";
import { formatDate, renderAssets, renderJson, renderPoster, renderReviewTimeline, renderStatusPill } from "./renderers.js";

const state = {
  user: null,
  works: [],
  selectedWorkId: null
};

function $(id) {
  return document.getElementById(id);
}

function notify(message, type = "info") {
  const node = $("dashboard-message");
  node.textContent = message;
  node.className = `status-pill status-${type === "error" ? "changes_requested" : "approved"}`;
  node.style.display = "inline-flex";
}

function renderMetrics() {
  const inReview = state.works.filter((work) => work.status === "in_review").length;
  const approved = state.works.filter((work) => work.status === "approved").length;
  const changes = state.works.filter((work) => work.status === "changes_requested").length;

  $("metrics-strip").innerHTML = [
    ["Review Queue", inReview, "当前待你签署医学审核意见的作品"],
    ["Approved", approved, "已通过临床可信审核"],
    ["Changes Requested", changes, "已退回，需要生成侧修订"],
    ["Assigned Works", state.works.length, "你可见的审核作品总数"]
  ].map(([label, value, hint]) => `
    <article class="metric-card">
      <p class="meta-text">${label}</p>
      <h3 class="page-title" style="font-size: 2.4rem; margin-top: 8px;">${value}</h3>
      <p class="meta-text">${hint}</p>
    </article>
  `).join("");
}

function renderQueue() {
  if (!state.works.length) {
    $("queue-list").innerHTML = `<div class="empty-state">当前没有待审核作品。</div>`;
    return;
  }

  $("queue-list").innerHTML = state.works.map((work) => `
    <button class="queue-item" data-work-id="${work.id}" style="${work.id === state.selectedWorkId ? "border-color: rgba(182,111,77,.45);" : ""}">
      <div class="inline-actions" style="justify-content: space-between;">
        <strong>${work.title}</strong>
        ${renderStatusPill(work.status)}
      </div>
      <p class="body-muted">${work.topic || "未填写主题"}</p>
      <p class="meta-text">更新于 ${formatDate(work.updatedAt)}</p>
    </button>
  `).join("");
}

function renderDetail() {
  const work = state.works.find((item) => item.id === state.selectedWorkId) || state.works[0];

  if (!work) {
    $("work-detail").innerHTML = `<div class="empty-state">请选择一个作品查看详情。</div>`;
    return;
  }

  state.selectedWorkId = work.id;

  $("work-detail").innerHTML = `
    <div class="section-stack">
      <section class="detail-card">
        <div class="inline-actions" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 class="section-title">${work.title}</h2>
            <p class="body-muted">${work.topic || "未填写主题"} · ${work.audience || "patient"} · ${work.format || "poster-video"}</p>
          </div>
          ${renderStatusPill(work.status)}
        </div>
        <div class="button-row" style="margin-top: 16px;">
          <button class="button" data-review-action="approve" data-work-id="${work.id}">临床通过</button>
          <button class="button-danger" data-review-action="changes_requested" data-work-id="${work.id}">要求修改</button>
        </div>
        <div class="field" style="margin-top: 18px;">
          <label for="review-note">审核备注</label>
          <textarea id="review-note" placeholder="例如：危险信号顺序可提前，家属共读提示建议加粗。"></textarea>
        </div>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Poster Preview</h3>
        <div style="margin-top: 18px;">${renderPoster(work.latestVersion?.posterPayload)}</div>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Assets</h3>
        <div class="card-list" style="margin-top: 18px;">${renderAssets(work.latestVersion?.assets || [])}</div>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Review Timeline</h3>
        <div class="stack-list" style="margin-top: 18px;">${renderReviewTimeline(work.reviewActions)}</div>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Master JSON</h3>
        <div style="margin-top: 18px;">${renderJson(work.latestVersion?.masterJson || {})}</div>
      </section>
    </div>
  `;
}

async function refresh() {
  const result = await api.get("/api/works");
  state.works = result.items;
  state.selectedWorkId = state.selectedWorkId || state.works[0]?.id || null;
  renderMetrics();
  renderQueue();
  renderDetail();
}

async function handleReviewAction(event) {
  const button = event.target.closest("[data-review-action]");
  if (!button) return;

  const note = $("review-note")?.value?.trim() || "";

  try {
    await api.post(`/api/works/${button.dataset.workId}/review`, {
      action: button.dataset.reviewAction,
      note
    });
    notify("审核动作已提交。");
    await refresh();
  } catch (error) {
    notify(error.message, "error");
  }
}

async function init() {
  state.user = await requireAuth({ roles: ["doctor-reviewer"] });
  if (!state.user) return;

  $("reviewer-name").textContent = state.user.displayName;
  bindLogoutButton($("logout-button"));

  $("queue-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-work-id]");
    if (!button) return;
    state.selectedWorkId = Number(button.dataset.workId);
    renderQueue();
    renderDetail();
  });

  $("work-detail").addEventListener("click", handleReviewAction);

  try {
    await refresh();
  } catch (error) {
    notify(error instanceof ApiError ? error.message : "加载审核队列失败。", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);