import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getActor } from "@/server/auth/session";
import { notification } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export async function GET() {
  const actor = await getActor();
  if (!actor) return Response.json({ error: "unauthorized" }, { status: 401 });

  // RLS limits these to the signed-in person.
  const summary = await readScoped(actor, async (tx) => {
    const latest = await tx
      .select({
        id: notification.id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .orderBy(desc(notification.createdAt))
      .limit(8);
    const [{ unread }] = await tx.select({ unread: count() }).from(notification).where(isNull(notification.readAt));
    const urgent = await tx
      .select({ id: notification.id, title: notification.title, body: notification.body, link: notification.link })
      .from(notification)
      .where(and(eq(notification.urgent, true), isNull(notification.ackedAt)))
      .orderBy(desc(notification.createdAt))
      .limit(3);
    return { latest, unread, urgent };
  });
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
