import { ApiError } from "./api.js";
import { getCurrentUser, login, redirectForRole } from "./auth-client.js";

const state = {
  role: "doctor-reviewer"
};

const roleConfigs = {
  "doctor-reviewer": {
    title: "临床使用入口",
    hint: "医生负责生成、审阅并确认 AI 科普作品，确认后再进入正式展示与分发。",
    usernameLabel: "账号",
    usernamePlaceholder: "doctor",
    helper: "演示账号：reviewer / review123"
  },
  admin: {
    title: "管理员入口",
    hint: "管理员负责账号与系统治理，不直接替代医生完成内容审阅。",
    usernameLabel: "管理员账号",
    usernamePlaceholder: "admin",
    helper: "演示账号：admin / admin123"
  }
};

function $(id) {
  return document.getElementById(id);
}

function setRole(role) {
  state.role = role;
  const config = roleConfigs[role];

  $("role-title").textContent = config.title;
  $("role-hint").textContent = config.hint;
  $("username-label").textContent = config.usernameLabel;
  $("username").placeholder = config.usernamePlaceholder;
  $("credential-helper").textContent = config.helper;

  document.querySelectorAll("[data-role-tab]").forEach((button) => {
    const active = button.dataset.roleTab === role;
    button.classList.toggle("tab-active", active);
    button.classList.toggle("text-slate-600", !active);
    button.classList.toggle("text-slate-800", !active);
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
    showMessage("正在验证身份...");

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

function bindPasswordToggle() {
  $("password-toggle")?.addEventListener("click", () => {
    const input = $("password");
    const icon = $("password-toggle").querySelector("i");
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    if (icon) {
      icon.className = nextType === "password" ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
    }
  });
}

async function init() {
  try {
    const user = await getCurrentUser();
    redirectForRole(user);
    return;
  } catch {
    // No active session.
  }

  const remembered = localStorage.getItem("mediark_last_account");
  if (remembered) {
    $("username").value = remembered;
    $("remember-account").checked = true;
  }

  document.querySelectorAll("[data-role-tab]").forEach((button) => {
    button.addEventListener("click", () => setRole(button.dataset.roleTab));
  });

  bindPasswordToggle();
  $("login-form").addEventListener("submit", handleSubmit);
  setRole(state.role);
}

document.addEventListener("DOMContentLoaded", init);
