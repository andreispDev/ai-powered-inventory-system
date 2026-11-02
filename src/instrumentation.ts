export async function register() {
  // A production deploy with bad settings should fail at boot, not on the first request.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { env } = await import("./server/env");
    env();
  }
}
