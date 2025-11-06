// src/api/client.ts
// Tiny fetch wrapper for your Smart Home app.
// - Sends cookies (credentials: 'include')
// - Parses JSON safely
// - Exposes normal and CSRF-aware helpers
// - Defaults to /api base path to work with Vite proxy

// --- Types ---
type JSONObject = Record<string, unknown>;
type JSONValue = JSONObject | JSONValue[] | string | number | boolean | null;
type Json = JSONObject | JSONValue[] | null;

export class APIError<T = unknown> extends Error {
  status: number;
  payload: T | null;
  constructor(message: string, status: number, payload: T | null = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}

// --- Config ---
const DEFAULT_BASE = "/api"; // works with Vite proxy to http://localhost:4000

let apiBase = DEFAULT_BASE;

/** Optionally set a different API base (e.g., full URL) */
export function setApiBase(base: string) {
  apiBase = base.replace(/\/+$/, "");
}

/** Build URL with current base */
function url(path: string): string {
  if (!path) return apiBase;
  // If the caller already passed an absolute URL, leave it
  if (/^https?:\/\//i.test(path)) return path;
  // Ensure exactly one slash between base and path
  if (path.startsWith("/")) return `${apiBase}${path}`;
  return `${apiBase}/${path}`;
}

// --- JSON helpers ---
async function parseJsonSafe(res: Response): Promise<Json | string | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return text; // non-JSON body
  }
}

function toHeaders(init?: HeadersInit): Headers {
  const h = new Headers(init ?? {});
  return h;
}

// --- Core request ---
interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
}

async function apiRequest<T = Json>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, headers } = opts;

  const res = await fetch(url(path), {
    method,
    credentials: "include", // send/receive cookies
    headers: toHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in (data as JSONObject) && String((data as JSONObject).error)) ||
      res.statusText ||
      "Request failed";
    throw new APIError(msg, res.status, (data ?? null) as T | null);
  }
  return data as T;
}

// --- Public helpers (no CSRF) ---
export async function apiGet<T = Json>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T = Json>(
  path: string,
  body?: unknown,
  extraHeaders?: HeadersInit
): Promise<T> {
  const headers = toHeaders(extraHeaders);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return apiRequest<T>(path, { method: "POST", body, headers });
}

export async function apiPut<T = Json>(
  path: string,
  body?: unknown,
  extraHeaders?: HeadersInit
): Promise<T> {
  const headers = toHeaders(extraHeaders);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return apiRequest<T>(path, { method: "PUT", body, headers });
}

export async function apiDelete<T = Json>(path: string, extraHeaders?: HeadersInit): Promise<T> {
  const headers = toHeaders(extraHeaders);
  return apiRequest<T>(path, { method: "DELETE", headers });
}

// --- CSRF-aware helpers ---
// If CSRF is enabled on the server, include the token header.
// This import is optional—if the file exists, we use it; otherwise we fall back gracefully.
let _getCsrfHeaders: null | (() => Promise<HeadersInit>) = null;

async function csrfHeaders(): Promise<HeadersInit> {
  if (_getCsrfHeaders === null) {
    try {
      // Dynamic import to avoid build errors if csrf.ts doesn't exist yet
      const mod = await import("./csrf");
      _getCsrfHeaders = mod.getCsrfHeaders as () => Promise<HeadersInit>;
    } catch {
      _getCsrfHeaders = async () => ({});
    }
  }
  return _getCsrfHeaders();
}

export async function apiPostCSRF<T = Json>(path: string, body?: unknown): Promise<T> {
  const csrf = await csrfHeaders();
  return apiPost<T>(path, body, csrf);
}

export async function apiPutCSRF<T = Json>(path: string, body?: unknown): Promise<T> {
  const csrf = await csrfHeaders();
  return apiPut<T>(path, body, csrf);
}

export async function apiDeleteCSRF<T = Json>(path: string): Promise<T> {
  const csrf = await csrfHeaders();
  return apiDelete<T>(path, csrf);
}
