import { api } from "./api.js";
import { renderAssets, renderPoster, renderStatusPill } from "./renderers.js";

const state = {
  works: [],
  filtered: [],
  activeId: null
};

function $(id) {
  return document.getElementById(id);
}

function uniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))];
}

function fillSelect(id, values) {
  const select = $(id);
  select.innerHTML = `<option value="">全部</option>${values.map((value) => `<option value="${value}">${value}</option>`).join("")}`;
}

function applyFilters() {
  const search = $("search-input").value.trim().toLowerCase();
  const topic = $("topic-filter").value;
  const format = $("format-filter").value;
  const audience = $("audience-filter").value;

  state.filtered = state.works.filter((work) => {
    const matchesSearch = !search || work.title.toLowerCase().includes(search) || work.summary.toLowerCase().includes(search);
    const matchesTopic = !topic || work.topic === topic;
    const matchesFormat = !format || work.format === format;
    const matchesAudience = !audience || work.audience === audience;
    return matchesSearch && matchesTopic && matchesFormat && matchesAudience;
  });

  renderGallery();
}

function renderGallery() {
  $("library-count").textContent = String(state.filtered.length);

  if (!state.filtered.length) {
    $("gallery-grid").innerHTML = `<div class="empty-state">没有符合筛选条件的已发布作品。</div>`;
    return;
  }

  $("gallery-grid").innerHTML = state.filtered.map((work) => `
    <article class="gallery-card" data-library-id="${work.id}">
      ${work.coverImage ? `<img src="${work.coverImage}" alt="${work.title}">` : `<div style="height:220px;background:linear-gradient(135deg,#d8e2e3,#f4e8dc);"></div>`}
      <div class="gallery-card-body">
        <div class="inline-actions" style="justify-content: space-between;">
          ${renderStatusPill("published")}
          <span class="meta-text">${work.format || "poster-video"}</span>
        </div>
        <h3 class="section-title" style="margin-top: 12px;">${work.title}</h3>
        <p class="body-muted">${work.summary || "暂无摘要。"}</p>
        <div class="button-row" style="margin-top: 16px;">
          <span class="chip">${work.topic || "General"}</span>
          <span class="chip">${work.audience || "patient"}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function openModal(work) {
  state.activeId = work.id;
  $("modal-title").textContent = work.title;
  $("modal-body").innerHTML = `
    <div class="section-stack">
      <section class="detail-card">
        <h3 class="section-title">Poster Preview</h3>
        <div style="margin-top: 16px;">${renderPoster(work.poster)}</div>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Published Summary</h3>
        <p class="body-muted">${work.summary || "暂无摘要。"}</p>
      </section>
      <section class="detail-card">
        <h3 class="section-title">Assets</h3>
        <div class="card-list" style="margin-top: 16px;">${renderAssets(work.assets || [])}</div>
      </section>
    </div>
  `;
  $("modal-root").classList.add("open");
}

function initFilters() {
  fillSelect("topic-filter", uniqueValues(state.works, "topic"));
  fillSelect("format-filter", uniqueValues(state.works, "format"));
  fillSelect("audience-filter", uniqueValues(state.works, "audience"));

  ["search-input", "topic-filter", "format-filter", "audience-filter"].forEach((id) => {
    $(id).addEventListener(id === "search-input" ? "input" : "change", applyFilters);
  });
}

async function init() {
  const result = await api.get("/api/library/works");
  state.works = result.items;
  state.filtered = result.items;
  initFilters();
  renderGallery();

  $("gallery-grid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-library-id]");
    if (!card) return;
    const work = state.works.find((item) => item.id === Number(card.dataset.libraryId));
    if (work) {
      openModal(work);
    }
  });

  $("modal-close").addEventListener("click", () => $("modal-root").classList.remove("open"));
  $("modal-root").addEventListener("click", (event) => {
    if (event.target === $("modal-root")) {
      $("modal-root").classList.remove("open");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
