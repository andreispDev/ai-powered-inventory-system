// Shared with the browser's timer, so nothing here can be server-only.
export const DEFAULT_IDLE_MINUTES = 5;
export const MIN_IDLE_MINUTES = 1;
// Sessions also end after 8 idle hours in the sign-in settings, so a longer limit would do nothing.
export const MAX_IDLE_MINUTES = 480;
export const IDLE_WARNING_MS = 30 * 1000;
// The browser reports activity once a minute, so the server allows for that gap and a slow network.
const SERVER_GRACE_MS = 90 * 1000;

/** The server's own check, for a browser whose timer never ran. */
export function isPastIdleLimit(lastActiveAt: Date, idleMinutes: number, now = new Date()): boolean {
  return now.getTime() - lastActiveAt.getTime() > idleMinutes * 60_000 + SERVER_GRACE_MS;
}
