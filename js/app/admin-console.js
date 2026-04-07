import { api, ApiError } from "./api.js";
import { bindLogoutButton, requireAuth } from "./auth-client.js";
import { formatDate, prettifyStatus, renderStatusPill } from "./renderers.js";

const state = {
  user: null,
  users: [],
  schemas: [],
  works: [],
  activeSchema: null
};

function $(id) {
  return document.getElementById(id);
}

function flash(message, type = "info") {
  const node = $("flash-message");
  if (!node) return;
  node.textContent = message;
  node.className = `status-pill status-${type === "error" ? "changes_requested" : "approved"}`;
  node.style.display = "inline-flex";
}

function clearFlash() {
  const node = $("flash-message");
  if (!node) return;
  node.style.display = "none";
}

async function loadAll() {
  const [usersResult, schemasResult, worksResult] = await Promise.all([
    api.get("/api/users"),
    api.get("/api/schemas"),
    api.get("/api/works").catch((error) => {
      if (error instanceof ApiError && error.status === 403) {
        return { items: [] };
      }
      throw error;
    })
  ]);

  state.users = usersResult.items;
  state.schemas = schemasResult.items;
  state.works = worksResult.items;

  const nextSlug = state.activeSchema?.schema?.slug || state.schemas[0]?.slug;
  if (nextSlug) {
    state.activeSchema = await api.get(`/api/schemas/${nextSlug}/active`);
  }
}

function renderMetrics() {
  const reviewers = state.users.filter((user) => ["doctor-reviewer", "doctor"].includes(user.role) && user.isActive).length;
  const pendingPublish = state.works.filter((work) => work.status === "approved").length;
  const published = state.works.filter((work) => work.status === "published").length;
  const draftLike = state.works.filter((work) => ["generated", "in_review", "changes_requested"].includes(work.status)).length;

  $("metrics-strip").innerHTML = [
    ["Active Users", state.users.filter((user) => user.isActive).length, "管理员与审核员均计入"],
    ["Doctor Reviewers", reviewers, "唯一具备临床审核权的角色"],
    ["Ready to Publish", pendingPublish, "仅 admin 可发布，但不能替代医学批准"],
    ["Live Pipeline Works", draftLike + published, "生成、审核、发布全流程作品"]
  ].map(([label, value, hint]) => `
    <article class="metric-card">
      <p class="meta-text">${label}</p>
      <h3 class="page-title" style="font-size: 2.5rem; margin-top: 8px;">${value}</h3>
      <p class="meta-text">${hint}</p>
    </article>
  `).join("");
}

function renderUsers() {
  $("user-table-body").innerHTML = state.users.map((user) => `
    <tr>
      <td>
        <strong>${user.displayName}</strong>
        <div class="meta-text">${user.username}</div>
      </td>
      <td>${user.role === "doctor" ? "doctor-reviewer" : user.role}</td>
      <td>${user.isActive ? renderStatusPill("approved") : renderStatusPill("archived")}</td>
      <td>${formatDate(user.updatedAt)}</td>
      <td>
        <div class="inline-actions">
          <button class="button-soft" data-user-action="toggle" data-user-id="${user.id}">
            ${user.isActive ? "停用" : "启用"}
          </button>
          <button class="button-ghost" data-user-action="reset" data-user-id="${user.id}">重置密码</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderSchemas() {
  $("schema-list").innerHTML = state.schemas.map((schema) => {
    const selected = schema.slug === state.activeSchema?.schema?.slug;
    return `
      <button class="queue-item" data-schema-slug="${schema.slug}" style="${selected ? "border-color: rgba(182,111,77,.45);" : ""}">
        <div class="inline-actions" style="justify-content: space-between;">
          <strong>${schema.name}</strong>
          ${schema.activeVersionId ? renderStatusPill("published") : renderStatusPill("draft")}
        </div>
        <p class="body-muted">${schema.slug}</p>
        <p class="meta-text">Active version ID: ${schema.activeVersionId || "N/A"}</p>
      </button>
    `;
  }).join("");

  $("schema-slug").value = state.activeSchema?.schema?.slug || "";
  $("schema-name").value = state.activeSchema?.schema?.name || "";
  $("schema-description").value = state.activeSchema?.schema?.description || "";
  $("schema-version-title").value = "";
  $("schema-editor").value = JSON.stringify(state.activeSchema?.version?.definition || {}, null, 2);
}

function renderWorks() {
  $("works-table-body").innerHTML = state.works.map((work) => `
    <tr>
      <td>
        <strong>${work.title}</strong>
        <div class="meta-text">#${work.id} · ${work.topic || "Untitled topic"}</div>
      </td>
      <td>${renderStatusPill(work.status)}</td>
      <td>${work.assignedReviewer?.displayName || "未指派"}</td>
      <td>${formatDate(work.updatedAt)}</td>
      <td>
        <div class="inline-actions">
          ${work.status === "approved" ? `<button class="button" data-work-action="publish" data-work-id="${work.id}">发布</button>` : ""}
          ${["published", "approved", "changes_requested", "generated"].includes(work.status) ? `<button class="button-ghost" data-work-action="archive" data-work-id="${work.id}">归档</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAll() {
  $("admin-name").textContent = state.user.displayName;
  renderMetrics();
  renderUsers();
  renderSchemas();
  renderWorks();
}

async function refresh() {
  clearFlash();
  await loadAll();
  renderAll();
}

async function handleUserCreate(event) {
  event.preventDefault();

  const payload = {
    username: $("new-username").value.trim(),
    displayName: $("new-display-name").value.trim(),
    role: $("new-role").value === "doctor-reviewer" ? "doctor" : $("new-role").value,
    password: $("new-password").value,
    isActive: true
  };

  try {
    await api.post("/api/users", payload);
    event.target.reset();
    flash("用户已创建。");
    await refresh();
  } catch (error) {
    flash(error.message, "error");
  }
}

async function handleUserAction(event) {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const userId = Number(button.dataset.userId);
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;

  try {
    if (button.dataset.userAction === "toggle") {
      await api.patch(`/api/users/${userId}`, { isActive: !user.isActive });
      flash(`已更新 ${user.displayName} 的启用状态。`);
    }

    if (button.dataset.userAction === "reset") {
      await api.patch(`/api/users/${userId}`, { password: "123456" });
      flash(`已将 ${user.displayName} 的密码重置为 123456。`);
    }

    await refresh();
  } catch (error) {
    flash(error.message, "error");
  }
}

async function handleSchemaSelection(event) {
  const button = event.target.closest("[data-schema-slug]");
  if (!button) return;

  state.activeSchema = await api.get(`/api/schemas/${button.dataset.schemaSlug}/active`);
  renderSchemas();
}

async function handleSchemaSave(event) {
  event.preventDefault();

  try {
    const definition = JSON.parse($("schema-editor").value);
    const mode = $("schema-mode").value;

    if (mode === "new") {
      await api.post("/api/schemas", {
        slug: $("schema-slug").value.trim(),
        name: $("schema-name").value.trim(),
        description: $("schema-description").value.trim(),
        title: $("schema-version-title").value.trim() || "v1",
        definition
      });
      flash("新 Schema 已创建并激活。");
    } else {
      const created = await api.post(`/api/schemas/${state.activeSchema.schema.id}/versions`, {
        title: $("schema-version-title").value.trim() || undefined,
        definition
      });
      await api.post(`/api/schemas/${state.activeSchema.schema.id}/activate`, {
        versionId: created.version.id
      });
      flash(`已创建并激活版本 ${created.version.version}。`);
    }

    await refresh();
  } catch (error) {
    flash(error instanceof SyntaxError ? "Schema JSON 不是合法格式。" : error.message, "error");
  }
}

async function handleWorkAction(event) {
  const button = event.target.closest("[data-work-action]");
  if (!button) return;

  const workId = Number(button.dataset.workId);

  try {
    if (button.dataset.workAction === "publish") {
      await api.post(`/api/works/${workId}/publish`, {});
      flash(`作品 #${workId} 已发布。`);
    }

    if (button.dataset.workAction === "archive") {
      await api.post(`/api/works/${workId}/archive`, {});
      flash(`作品 #${workId} 已归档。`);
    }

    await refresh();
  } catch (error) {
    flash(error.message, "error");
  }
}

async function init() {
  state.user = await requireAuth({ roles: ["admin"] });
  if (!state.user) return;

  bindLogoutButton($("logout-button"));

  $("user-create-form").addEventListener("submit", handleUserCreate);
  $("user-table-body").addEventListener("click", handleUserAction);
  $("schema-list").addEventListener("click", handleSchemaSelection);
  $("schema-editor-form").addEventListener("submit", handleSchemaSave);
  $("works-table-body").addEventListener("click", handleWorkAction);

  try {
    await refresh();
  } catch (error) {
    flash(error instanceof ApiError ? error.message : "加载后台数据失败。", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
