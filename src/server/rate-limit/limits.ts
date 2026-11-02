export const LIMITS = {
  read: { max: 300, windowMs: 60_000 },
  write: { max: 60, windowMs: 60_000 },
  bulk: { max: 5, windowMs: 60_000 },
  /** Per email, whichever IP address asks */
  signInCode: { max: 5, windowMs: 15 * 60_000 },
} as const;

export type LimitClass = keyof typeof LIMITS;

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

const hits = new Map<string, number[]>();

/** Used when Redis is unavailable. Counts are per server process. */
export function memoryLimit(limitClass: LimitClass, key: string, now = Date.now()): LimitResult {
  const { max, windowMs } = LIMITS[limitClass];
  const id = `${limitClass}:${key}`;
  const recent = (hits.get(id) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= max) {
    hits.set(id, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  hits.set(id, [...recent, now]);
  return { ok: true };
}
