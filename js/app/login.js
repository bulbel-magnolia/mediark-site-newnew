import { ApiError } from "./api.js";
import { getCurrentUser, login, redirectForRole } from "./auth-client.js";

const state = {
  role: "doctor-reviewer"
};

function $(id) {
  return document.getElementById(id);
}

function applyRoleVisuals() {
  const configs = {
    "doctor-reviewer": {
      title: "临床审核入口",
      hint: "用于审核 AI 生成的医学科普处方、签署临床可信意见。",
      usernameLabel: "审核账号",
      usernamePlaceholder: "reviewer",
      helper: "默认演示账号：reviewer / review123"
    },
    admin: {
      title: "运营管理入口",
      hint: "用于用户管理、Schema 版本管理、作品发布与归档。",
      usernameLabel: "管理员账号",
      usernamePlaceholder: "admin",
      helper: "默认演示账号：admin / admin123"
    }
  };

  const config = configs[state.role];
  $("role-title").textContent = config.title;
  $("role-hint").textContent = config.hint;
  $("username-label").textContent = config.usernameLabel;
  $("username").placeholder = config.usernamePlaceholder;
  $("credential-helper").textContent = config.helper;

  document.querySelectorAll("[data-role-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.roleTab === state.role);
  });
}

function showMessage(message, type = "info") {
  const node = $("login-message");
  node.textContent = message || "";
  node.className = `status-pill status-${type === "error" ? "changes_requested" : "generated"}`;
  node.style.display = message ? "inline-flex" : "none";
}

async function handleSubmit(event) {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;
  const remember = $("remember-account").checked;

  if (!username || !password) {
    showMessage("请输入账号和密码。", "error");
    return;
  }

  try {
    $("login-button").disabled = true;
    showMessage("正在验证身份…");
    const user = await login({ username, password });

    if (remember) {
      localStorage.setItem("mediark_last_account", username);
    } else {
      localStorage.removeItem("mediark_last_account");
    }

    redirectForRole(user);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "登录失败，请稍后重试。";
    showMessage(message, "error");
    $("login-button").disabled = false;
  }
}

async function init() {
  try {
    const user = await getCurrentUser();
    redirectForRole(user);
    return;
  } catch {
    // Continue with login screen when there is no active session.
  }

  const remembered = localStorage.getItem("mediark_last_account");
  if (remembered) {
    $("username").value = remembered;
    $("remember-account").checked = true;
  }

  document.querySelectorAll("[data-role-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.role = button.dataset.roleTab;
      applyRoleVisuals();
    });
  });

  $("login-form").addEventListener("submit", handleSubmit);
  applyRoleVisuals();
}

document.addEventListener("DOMContentLoaded", init);
