export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export const api = {
  get(path) {
    return apiRequest(path);
  },
  post(path, body) {
    return apiRequest(path, { method: "POST", body });
  },
  patch(path, body) {
    return apiRequest(path, { method: "PATCH", body });
  }
};
