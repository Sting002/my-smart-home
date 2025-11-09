// src/api/csrf.ts
// CSRF utilities for the Smart Home app

type CsrfResponse = { token: string; enabled?: boolean };

let cachedToken: string | null = null;
let lastFetchedAt = 0;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function stillFresh(): boolean {
  return cachedToken !== null && Date.now() - lastFetchedAt < TTL_MS;
}

/** Fetch a new CSRF token from the backend. */
async function fetchCsrfToken(): Promise<string> {
  // Assumes Vite dev proxy maps /api -> http://localhost:4000
  const res = await fetch("/api/csrf", {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch CSRF token (${res.status}): ${text}`);
  }

  const data = (await res.json()) as CsrfResponse;
  if (!data?.token) {
    throw new Error("CSRF token response missing token field");
  }
  cachedToken = data.token;
  lastFetchedAt = Date.now();
  return cachedToken;
}

/** Ensure we have a fresh CSRF token in memory and return it. */
export async function ensureCsrfToken(): Promise<string> {
  if (stillFresh()) return cachedToken as string;
  return fetchCsrfToken();
}

/** Clear cached token (e.g., on logout). */
export function clearCsrfToken(): void {
  cachedToken = null;
  lastFetchedAt = 0;
}

/**
 * Build headers that include the CSRF token.
 * Use this with state-changing requests when CSRF protection is enabled server-side.
 */
export async function getCsrfHeaders(): Promise<HeadersInit> {
  const token = await ensureCsrfToken();
  return {
    "Content-Type": "application/json",
    "X-CSRF-Token": token,
  };
}
