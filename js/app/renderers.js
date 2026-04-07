import { renderPosterMarkup } from "../prescription/poster-renderer.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
}

export function prettifyStatus(status) {
  return String(status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function renderStatusPill(status) {
  return `<span class="status-pill status-${escapeHtml(status)}">${prettifyStatus(status)}</span>`;
}

export function renderPoster(payload) {
  if (!payload) {
    return `<div class="empty-state">暂无海报预览。</div>`;
  }

  return `<div class="preview-frame">${renderPosterMarkup(payload)}</div>`;
}

export function renderAssets(assets = []) {
  if (!assets.length) {
    return `<div class="empty-state">暂无多模态资产。</div>`;
  }

  return assets.map((asset) => `
    <article class="asset-card">
      <div class="inline-actions" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <strong>${escapeHtml(asset.assetKey || asset.payload?.id || asset.assetType)}</strong>
          <div class="meta-text">${escapeHtml(asset.provider || "unknown")} · ${escapeHtml(asset.model || "-")}</div>
        </div>
        ${renderStatusPill(asset.status || "draft")}
      </div>
      <div class="meta-text" style="margin-top: 10px;">${escapeHtml(asset.assetType)}</div>
      ${asset.url ? `<div style="margin-top: 10px;"><a class="button-ghost" href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">打开资源</a></div>` : ""}
    </article>
  `).join("");
}

export function renderJson(data) {
  return `<pre class="code-panel">${escapeHtml(JSON.stringify(data ?? {}, null, 2))}</pre>`;
}

export function renderReviewTimeline(actions = []) {
  if (!actions.length) {
    return `<div class="empty-state">还没有审核动作。</div>`;
  }

  return actions.map((action) => `
    <article class="mini-card">
      <div class="inline-actions" style="justify-content: space-between;">
        <strong>${escapeHtml(action.reviewerName || "System")}</strong>
        <span class="meta-text">${formatDate(action.createdAt)}</span>
      </div>
      <div style="margin-top: 10px;">${renderStatusPill(action.action)}</div>
      ${action.note ? `<p class="body-muted" style="margin-top: 12px;">${escapeHtml(action.note)}</p>` : ""}
    </article>
  `).join("");
}