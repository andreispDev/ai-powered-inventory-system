// What the worker does for each event and schedule. No Redis here, so tests can run it directly.
import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  announcement,
  appUser,
  assignment,
  auditCheckpoint,
  item,
  notification,
  office,
  transfer,
} from "../server/db/schema";
import type { ScopedTx } from "../server/db/scope";

export type OutboxEvent = { id: string; topic: string; payload: Record<string, unknown> };

type Note = { title: string; body?: string; link?: string; urgent?: boolean; kind: string; dedupeKey: string; announcementId?: string };

const formatDay = (day: string | Date) =>
  new Date(day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Creates each notification once, however often the event is retried. Returns who got a new one. */
async function notify(tx: ScopedTx, userIds: string[], note: Note): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await tx
    .insert(notification)
    .values(
      [...new Set(userIds)].map((userId) => ({
        userId,
        kind: note.kind,
        title: note.title,
        body: note.body,
        link: note.link,
        urgent: note.urgent ?? false,
        announcementId: note.announcementId,
        dedupeKey: note.dedupeKey,
      })),
    )
    .onConflictDoNothing()
    .returning({ userId: notification.userId });
  return rows.map((row) => row.userId);
}

const activeInOffices = async (tx: ScopedTx, officeIds: string[], role?: "admin" | "user") => {
  const rows = await tx
    .select({ id: appUser.id })
    .from(appUser)
    .where(
      and(
        inArray(appUser.officeId, officeIds),
        sql`${appUser.status} <> 'deactivated'`,
        role ? eq(appUser.role, role) : undefined,
      ),
    );
  return rows.map((row) => row.id);
};

const developers = async (tx: ScopedTx) => {
  const rows = await tx
    .select({ id: appUser.id })
    .from(appUser)
    .where(and(eq(appUser.role, "developer"), sql`${appUser.status} <> 'deactivated'`));
  return rows.map((row) => row.id);
};

/** Sends an announcement once. A restart mid-send picks up where it left off. */
export async function sendAnnouncement(tx: ScopedTx, id: string): Promise<string[]> {
  const [row] = await tx.select().from(announcement).where(eq(announcement.id, id)).for("update");
  if (!row || row.sentAt) return [];
  if (row.scheduledAt && row.scheduledAt > new Date()) return [];

  const audience = await tx
    .select({ id: appUser.id })
    .from(appUser)
    .where(
      and(
        sql`${appUser.status} <> 'deactivated'`,
        row.audienceType === "offices" ? inArray(appUser.officeId, row.audienceOfficeIds ?? []) : undefined,
        row.audienceType === "role" && row.audienceRole ? eq(appUser.role, row.audienceRole) : undefined,
      ),
    );
  const notified = await notify(
    tx,
    audience.map((person) => person.id),
    {
      kind: "announcement",
      title: row.title,
      body: row.body,
      urgent: row.urgent,
      link: "/notifications",
      announcementId: row.id,
      dedupeKey: `announcement:${row.id}`,
    },
  );
  await tx.update(announcement).set({ sentAt: new Date() }).where(eq(announcement.id, id));
  return notified;
}

/** Runs one event inside the relay's transaction. Returns the people to alert live. */
export async function handleEvent(tx: ScopedTx, event: OutboxEvent): Promise<string[]> {
  const payload = event.payload;
  switch (event.topic) {
    case "transfer.requested": {
      const [row] = await tx.select().from(transfer).where(eq(transfer.id, String(payload.transferId)));
      if (!row) return [];
      return notify(tx, await activeInOffices(tx, [row.toOfficeId], "admin"), {
        kind: "transfer",
        title: `${row.fromOfficeName} wants to send you ${row.quantity} ${row.unit} of ${row.itemName}`,
        body: `Requested by ${row.requestedByName}. Accept or reject it.`,
        link: `/transfers/${row.id}`,
        dedupeKey: `transfer.requested:${row.id}`,
      });
    }
    case "transfer.completed": {
      const [row] = await tx.select().from(transfer).where(eq(transfer.id, String(payload.transferId)));
      if (!row) return [];
      return notify(tx, await activeInOffices(tx, [row.fromOfficeId, row.toOfficeId]), {
        kind: "transfer",
        title: `${row.quantity} ${row.unit} of ${row.itemName} was given to ${row.toOfficeName}`,
        body: `Since ${formatDay(row.respondedAt ?? new Date())}, by ${row.requestedByName}. Accepted by ${row.respondedByName}.`,
        link: `/transfers/${row.id}`,
        dedupeKey: `transfer.completed:${row.id}`,
      });
    }
    case "transfer.rejected":
    case "transfer.cancelled": {
      const [row] = await tx.select().from(transfer).where(eq(transfer.id, String(payload.transferId)));
      if (!row) return [];
      const rejected = event.topic === "transfer.rejected";
      return notify(tx, await activeInOffices(tx, [rejected ? row.fromOfficeId : row.toOfficeId], "admin"), {
        kind: "transfer",
        title: `Transfer of ${row.itemName} was ${rejected ? "rejected" : "cancelled"}`,
        body: rejected ? `By ${row.respondedByName} at ${row.toOfficeName}.` : `By ${row.fromOfficeName}.`,
        link: `/transfers/${row.id}`,
        dedupeKey: `${event.topic}:${row.id}`,
      });
    }
    case "assignment.created": {
      const [row] = await tx
        .select({
          id: assignment.id,
          officeId: assignment.officeId,
          assigneeId: assignment.assigneeId,
          since: assignment.since,
          itemId: assignment.itemId,
          itemName: item.name,
        })
        .from(assignment)
        .innerJoin(item, eq(assignment.itemId, item.id))
        .where(eq(assignment.id, String(payload.assignmentId)));
      if (!row) return [];
      const admins = await activeInOffices(tx, [row.officeId], "admin");
      return notify(tx, [row.assigneeId, ...admins], {
        kind: "assignment",
        title: `${row.itemName} was given to ${String(payload.assigneeName)}`,
        body: `Since ${formatDay(row.since)}, by ${String(payload.assignedByName)}.`,
        link: `/inventory/${row.itemId}`,
        dedupeKey: `assignment.created:${row.id}`,
      });
    }
    case "announcement.created":
      return sendAnnouncement(tx, String(payload.announcementId));
    case "permission.changed":
      return notify(tx, (payload.userIds as string[]) ?? [], {
        kind: "permission",
        title: "Your access has changed",
        body: String(payload.summary ?? ""),
        dedupeKey: `permission:${event.id}`,
      });
    default:
      return [];
  }
}

/** Sends scheduled announcements that are now due. */
export async function dispatchAnnouncements(tx: ScopedTx): Promise<Map<string, string[]>> {
  const due = await tx
    .select({ id: announcement.id })
    .from(announcement)
    .where(
      and(
        isNull(announcement.sentAt),
        or(isNull(announcement.scheduledAt), lte(announcement.scheduledAt, new Date())),
      ),
    )
    .limit(50);
  const result = new Map<string, string[]>();
  for (const { id } of due) result.set(id, await sendAnnouncement(tx, id));
  return result;
}

/** Daily checks. The date in each key means one reminder per thing, per day at most. */
export async function scanReminders(tx: ScopedTx, now = new Date()): Promise<string[]> {
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const warrantySoon = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const notified: string[] = [];

  const offices = await tx.select({ id: office.id }).from(office).where(eq(office.status, "active"));
  for (const { id: officeId } of offices) {
    const admins = await activeInOffices(tx, [officeId], "admin");

    const lowStock = await tx
      .select({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit })
      .from(item)
      .where(and(eq(item.officeId, officeId), isNull(item.deletedAt), sql`${item.reorderLevel} is not null and ${item.quantity} <= ${item.reorderLevel}`))
      .limit(50);
    for (const row of lowStock) {
      notified.push(
        ...(await notify(tx, admins, {
          kind: "low_stock",
          title: `${row.name} is low on stock`,
          body: `${row.quantity} ${row.unit} left.`,
          link: `/inventory/${row.id}`,
          dedupeKey: `low_stock:${row.id}:${today}`,
        })),
      );
    }

    const warranties = await tx
      .select({ id: item.id, name: item.name, warrantyExpiry: item.warrantyExpiry })
      .from(item)
      .where(and(eq(item.officeId, officeId), isNull(item.deletedAt), gt(item.warrantyExpiry, today), lte(item.warrantyExpiry, warrantySoon)))
      .limit(50);
    for (const row of warranties) {
      notified.push(
        ...(await notify(tx, admins, {
          kind: "warranty",
          title: `${row.name}'s warranty ends soon`,
          body: `On ${formatDay(row.warrantyExpiry!)}.`,
          link: `/inventory/${row.id}`,
          dedupeKey: `warranty:${row.id}:${row.warrantyExpiry}`,
        })),
      );
    }

    const returns = await tx
      .select({ id: assignment.id, itemId: assignment.itemId, assigneeId: assignment.assigneeId, dueAt: assignment.dueAt, name: item.name })
      .from(assignment)
      .innerJoin(item, eq(assignment.itemId, item.id))
      .where(and(eq(assignment.officeId, officeId), isNull(assignment.returnedAt), lte(assignment.dueAt, soon)))
      .limit(100);
    for (const row of returns) {
      const overdue = row.dueAt! < today;
      notified.push(
        ...(await notify(tx, [row.assigneeId, ...admins], {
          kind: "return",
          title: overdue ? `${row.name} is overdue` : `${row.name} is due back soon`,
          body: `Return date: ${formatDay(row.dueAt!)}.`,
          link: `/inventory/${row.itemId}`,
          urgent: overdue,
          dedupeKey: `return:${row.id}:${today}`,
        })),
      );
    }

    const stale = await tx
      .select({ id: transfer.id, itemName: transfer.itemName, fromOfficeName: transfer.fromOfficeName })
      .from(transfer)
      .where(and(eq(transfer.toOfficeId, officeId), eq(transfer.status, "pending"), lte(transfer.createdAt, new Date(now.getTime() - 3 * 86_400_000))))
      .limit(50);
    for (const row of stale) {
      notified.push(
        ...(await notify(tx, admins, {
          kind: "transfer",
          title: `A transfer of ${row.itemName} is waiting for you`,
          body: `From ${row.fromOfficeName}.`,
          link: `/transfers/${row.id}`,
          dedupeKey: `transfer.stale:${row.id}:${today}`,
        })),
      );
    }
  }
  return notified;
}

const AUDIT_COLUMNS = sql`id::text, coalesce(office_id::text,''), coalesce(actor_id::text,''), coalesce(actor_role::text,''), action, coalesce(entity_type,''), coalesce(entity_id,''), coalesce(before::text,''), coalesce(after::text,''), coalesce(request_id,''), coalesce(ip,''), at::text`;

async function auditRows(tx: ScopedTx, afterId: bigint, upToId: bigint | null, limit: number) {
  const { rows } = (await tx.execute(
    sql`select concat_ws('|', ${AUDIT_COLUMNS}) as line, id::text as id from audit_log
        where id > ${afterId.toString()}::bigint ${upToId ? sql`and id <= ${upToId.toString()}::bigint` : sql``}
        order by id limit ${limit}`,
  )) as unknown as { rows: { line: string; id: string }[] };
  return rows;
}

const chain = (previous: string, line: string) => createHash("sha256").update(previous).update(line).digest("hex");

/** Extends the tamper-evident hash chain over new audit entries. */
export async function checkpointAudit(tx: ScopedTx): Promise<bigint | null> {
  const [last] = await tx.select().from(auditCheckpoint).orderBy(sql`${auditCheckpoint.upToId} desc`).limit(1);
  const rows = await auditRows(tx, last?.upToId ?? BigInt(0), null, 5000);
  if (rows.length === 0) return null;
  const hash = rows.reduce((previous, row) => chain(previous, row.line), last?.hash ?? "");
  const upToId = BigInt(rows.at(-1)!.id);
  await tx.insert(auditCheckpoint).values({ upToId, hash });
  return upToId;
}

/** Recomputes the chain. Any edited or deleted entry changes a hash, and Developers are alerted. */
export async function verifyAudit(tx: ScopedTx): Promise<{ ok: boolean; brokenAt?: string; alerted: string[] }> {
  const checkpoints = await tx.select().from(auditCheckpoint).orderBy(asc(auditCheckpoint.upToId));
  let previous = "";
  let from = BigInt(0);
  for (const checkpoint of checkpoints) {
    let hash = previous;
    let cursor = from;
    for (;;) {
      const rows = await auditRows(tx, cursor, checkpoint.upToId, 5000);
      if (rows.length === 0) break;
      hash = rows.reduce((value, row) => chain(value, row.line), hash);
      cursor = BigInt(rows.at(-1)!.id);
    }
    if (hash !== checkpoint.hash) {
      const alerted = await notify(tx, await developers(tx), {
        kind: "security",
        title: "The audit log may have been changed",
        body: `The hash chain doesn't match at entry ${checkpoint.upToId}. Investigate before relying on the logs.`,
        link: "/logs",
        urgent: true,
        dedupeKey: `audit.break:${checkpoint.upToId}`,
      });
      return { ok: false, brokenAt: checkpoint.upToId.toString(), alerted };
    }
    previous = checkpoint.hash;
    from = checkpoint.upToId;
  }
  return { ok: true, alerted: [] };
}

