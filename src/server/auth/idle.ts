// Shared with the browser's timer, so nothing here can be server-only.
export const IDLE_LIMIT_MS = 5 * 60 * 1000;
export const IDLE_WARNING_MS = 30 * 1000;
// The browser reports activity once a minute, so the server allows for that gap and a slow network.
const SERVER_GRACE_MS = 90 * 1000;

/** The server's own check, for a browser whose timer never ran. */
export function isPastIdleLimit(lastActiveAt: Date, now = new Date()): boolean {
  return now.getTime() - lastActiveAt.getTime() > IDLE_LIMIT_MS + SERVER_GRACE_MS;
}
