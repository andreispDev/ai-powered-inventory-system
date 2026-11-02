import { eq } from "drizzle-orm";
import { getAuth } from "@/server/auth/config";
import { actorFromHeaders, recordIdleSignOut } from "@/server/auth/session";
import { getAuthDb } from "@/server/db/client";
import { session } from "@/server/db/schema";

const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !!origin && new URL(origin).host === request.headers.get("host");
};

/** The browser saying someone is really there. Background requests don't count, so they can't keep a session alive. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const actor = await actorFromHeaders(request.headers);
  const current = actor && (await getAuth().api.getSession({ headers: request.headers }));
  if (!current) return new Response("Unauthorized", { status: 401 });
  await getAuthDb().update(session).set({ lastActiveAt: new Date() }).where(eq(session.id, current.session.id));
  return new Response(null, { status: 204 });
}

/** The browser's idle timer ran out. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const current = await getAuth().api.getSession({ headers: request.headers });
  if (current) await recordIdleSignOut(current.session.id, current.user.id);
  return new Response(null, { status: 204 });
}
