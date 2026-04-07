import { api, ApiError } from "./api.js";

export async function getCurrentUser() {
  const result = await api.get("/api/auth/me");
  return result.user;
}

export async function login(credentials) {
  const result = await api.post("/api/auth/login", credentials);
  return result.user;
}

export async function logout() {
  await api.post("/api/auth/logout", {});
}

export function redirectForRole(user) {
  if (!user) {
    window.location.href = "Login.html";
    return;
  }

  if (user.role === "admin") {
    window.location.href = "Admin.html";
    return;
  }

  if (user.role === "doctor-reviewer") {
    window.location.href = "dashboard.html";
    return;
  }

  window.location.href = "Login.html";
}

export async function requireAuth({ roles = [] } = {}) {
  try {
    const user = await getCurrentUser();

    if (roles.length && !roles.includes(user.role)) {
      redirectForRole(user);
      return null;
    }

    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      window.location.href = "Login.html";
      return null;
    }

    throw error;
  }
}

export function bindLogoutButton(button, afterLogout = "Login.html") {
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    try {
      await logout();
    } finally {
      window.location.href = afterLogout;
    }
  });
}
