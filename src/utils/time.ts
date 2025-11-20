/** Normalize numeric or string timestamps to milliseconds since epoch. */
export function toMillis(value?: number | string | null, fallback = Date.now()): number {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return fallback;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}
