import { inArray } from "drizzle-orm";
import { getActor } from "@/server/auth/session";
import { appUser } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";
import { withRedis } from "@/server/rate-limit";

const ONLINE_WINDOW_MS = 60_000;

export async function GET() {
  const actor = await getActor();
  if (!actor) return Response.json({ error: "unauthorized" }, { status: 401 });

  const all = actor.permissions.includes("monitor.all");
  if (!all && !actor.permissions.includes("monitor.office")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const key = all ? "presence:all" : `presence:office:${actor.officeId}`;
  const now = Date.now();
  const ids = await withRedis(async (redis) => {
    await redis.zremrangebyscore(key, 0, now - ONLINE_WINDOW_MS * 5);
    return redis.zrangebyscore(key, now - ONLINE_WINDOW_MS, "+inf");
  });
  if (ids === null) return Response.json({ available: false, people: [] });
  if (ids.length === 0) return Response.json({ available: true, people: [] });

  // Names go through RLS, so an office only ever sees its own people.
  const people = await readScoped(actor, (tx) =>
    tx.select({ id: appUser.id, name: appUser.name, role: appUser.role, officeId: appUser.officeId }).from(appUser).where(inArray(appUser.id, ids)),
  );
  return Response.json({ available: true, people }, { headers: { "Cache-Control": "no-store" } });
}
