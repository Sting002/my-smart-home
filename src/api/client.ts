// src/api/client.ts
import { ensureCsrfToken } from "./csrf";

export class APIError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}

// Use Vite env when available, fall back to "/api".
// Cast through unknown (not `any`) to keep ESLint happy even if vite types aren't loaded.
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const API_BASE = viteEnv?.VITE_API_BASE ?? "/api";

/** Join base + path safely */
function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = joinUrl(API_BASE, path);

  const method = String((init.method || "GET")).toUpperCase();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (method !== "GET") {
    try {
      const token = await ensureCsrfToken();
      (headers as Record<string, string>)["X-CSRF-Token"] = token;
    } catch {
      // Server may have CSRF disabled; ignore fetch failure
    }
  }

  const res = await fetch(url, {
    credentials: "include", // send cookies (session)
    headers,
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      typeof body === "string"
        ? body
        : (typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof (body as { error?: unknown }).error === "string" &&
            (body as { error: string }).error) ||
          (typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof (body as { message?: unknown }).message === "string" &&
            (body as { message: string }).message) ||
          "Request failed";
    throw new APIError(msg, res.status, body);
  }
  return body as T;
}

export function apiGet<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T, B = unknown>(path: string, body?: B) {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T, B = unknown>(path: string, body?: B) {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

// Optional default api object
export const api = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  del: apiDelete,
};
