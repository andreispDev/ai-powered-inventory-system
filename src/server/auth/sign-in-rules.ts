export type SignInUser = { emailVerified: boolean; status: "invited" | "active" | "deactivated" };

/** Decides whether an account may get a session. Everything not listed is denied. */
export function canStartSession(user: SignInUser | undefined): boolean {
  return !!user && user.emailVerified && user.status !== "deactivated";
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const CODE_LIMIT = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const requests = new Map<string, number[]>();

/**
 * Limits codes per email, whatever IP address asks, so no one can flood an inbox or keep guessing.
 * Counts are per server process for now, and move to Redis with the Phase 1 rate limiter.
 */
export function canRequestCode(email: string, now = Date.now()): boolean {
  const key = normalizeEmail(email);
  const recent = (requests.get(key) ?? []).filter((at) => now - at < CODE_WINDOW_MS);
  if (recent.length >= CODE_LIMIT) {
    requests.set(key, recent);
    return false;
  }
  requests.set(key, [...recent, now]);
  return true;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Sessions roll while in use, but end 7 days after sign-in regardless. */
export function isPastAbsoluteLimit(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > SEVEN_DAYS_MS;
}
