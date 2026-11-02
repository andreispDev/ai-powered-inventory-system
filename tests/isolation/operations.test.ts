import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import {
  announcement,
  appUser,
  assignment,
  auditCheckpoint,
  auditLog,
  category,
  item,
  notification,
  office,
  stockMovement,
  transfer,
} from "@/server/db/schema";
import { runScoped, type Scope, type ScopedTx } from "@/server/db/scope";
import {
  checkpointAudit,
  dispatchAnnouncements,
  handleEvent,
  scanReminders,
  sendAnnouncement,
  verifyAudit,
} from "@/worker/events";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const [A, B] = [id("a"), id("b")];
const [ADMIN_A, USER_A, ADMIN_B, USER_B, DEV] = [id("a1"), id("a2"), id("b1"), id("b2"), id("d1")];
const [CAT_A, CAT_B, CAT_B_ARCHIVED, ITEM_A] = [id("ca"), id("cb"), id("cc"), id("ea")];

const scopeA: Scope = { kind: "office", officeId: A, userId: ADMIN_A };
const scopeUserA: Scope = { kind: "office", officeId: A, userId: USER_A };
const scopeB: Scope = { kind: "office", officeId: B, userId: ADMIN_B };
const scopeUserB: Scope = { kind: "office", officeId: B, userId: USER_B };
const platform: Scope = { kind: "platform", userId: DEV };

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

const asApp = <T>(scope: Scope, fn: (tx: ScopedTx) => Promise<T>): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local role inventory_app`);
    return runScoped(tx as never, scope, fn);
  });

const asWorker = <T>(fn: (tx: ScopedTx) => Promise<T>): Promise<T> =>
  asApp({ kind: "platform", userId: id("0") }, async (tx) => {
    await tx.execute(sql`select set_config('app.worker', 'on', true)`);
    return fn(tx);
  });

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: Error & { cause?: Error }) => e.cause?.message ?? e.message,
  );

const newTransfer = async (quantity: number, fromItem = ITEM_A) => {
  const [row] = await db
    .insert(transfer)
    .values({
      fromOfficeId: A,
      toOfficeId: B,
      fromOfficeName: "Office A",
      toOfficeName: "Office B",
      itemId: fromItem,
      itemName: "Chair",
      itemSku: "CH-1",
      unit: "pcs",
      quantity,
      requestedBy: ADMIN_A,
      requestedByName: "Maria",
    })
    .returning();
  return row;
};

const complete = (scope: Scope, transferId: string, categoryId = CAT_B, actor = ADMIN_B) =>
  asApp(scope, (tx) => tx.execute(sql`select complete_transfer(${transferId}::uuid, ${categoryId}::uuid, ${actor}::uuid, 'Bea')`));

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await db.insert(office).values([
    { id: A, code: "A", name: "Office A" },
    { id: B, code: "B", name: "Office B" },
  ]);
  await db.insert(appUser).values([
    { id: ADMIN_A, name: "Maria", email: "ma@e.test", role: "admin", officeId: A },
    { id: USER_A, name: "Juan", email: "ua@e.test", role: "user", officeId: A },
    { id: ADMIN_B, name: "Bea", email: "mb@e.test", role: "admin", officeId: B },
    { id: USER_B, name: "Ben", email: "ub@e.test", role: "user", officeId: B },
    { id: DEV, name: "Dev", email: "d@e.test", role: "developer" },
  ]);
  await db.insert(category).values([
    { id: CAT_A, officeId: A, name: "Furniture" },
    { id: CAT_B, officeId: B, name: "Received" },
    { id: CAT_B_ARCHIVED, officeId: B, name: "Old", archivedAt: new Date() },
  ]);
  await db.insert(item).values({ id: ITEM_A, officeId: A, categoryId: CAT_A, name: "Chair", sku: "CH-1", quantity: 20 });
});

describe("transfers", () => {
  it("shows a transfer to both offices and hides it from a third party's data", async () => {
    const row = await newTransfer(1);
    await asApp(scopeA, async (tx) => expect((await tx.select().from(transfer).where(eq(transfer.id, row.id))).length).toBe(1));
    await asApp(scopeB, async (tx) => {
      expect((await tx.select().from(transfer).where(eq(transfer.id, row.id))).length).toBe(1);
      // Seeing the transfer doesn't reveal the other office's item.
      expect(await tx.select().from(item).where(eq(item.id, ITEM_A))).toEqual([]);
    });
    await db.update(transfer).set({ status: "cancelled" }).where(eq(transfer.id, row.id));
  });

  it("can't be created on another office's behalf", async () => {
    const attempt = asApp(scopeB, (tx) =>
      tx.insert(transfer).values({
        fromOfficeId: A,
        toOfficeId: B,
        fromOfficeName: "A",
        toOfficeName: "B",
        itemId: ITEM_A,
        itemName: "x",
        unit: "pcs",
        quantity: 20,
        requestedBy: ADMIN_B,
        requestedByName: "x",
      }),
    );
    expect(await failure(attempt)).not.toBeNull();
  });

  it("can only be completed by the receiving office", async () => {
    const row = await newTransfer(1);
    expect(await failure(complete(scopeA, row.id, CAT_B, ADMIN_A))).toContain("transfer_not_found");
    expect(await failure(complete(platform, row.id, CAT_B, DEV))).toContain("transfer_not_found");
    await db.update(transfer).set({ status: "cancelled" }).where(eq(transfer.id, row.id));
  });

  it("rejects a category that isn't the receiver's, or is archived", async () => {
    const row = await newTransfer(1);
    expect(await failure(complete(scopeB, row.id, CAT_A))).toContain("transfer_bad_category");
    expect(await failure(complete(scopeB, row.id, CAT_B_ARCHIVED))).toContain("transfer_bad_category");
    await db.update(transfer).set({ status: "cancelled" }).where(eq(transfer.id, row.id));
  });

  it("moves stock, writes both histories and logs once, and adds to a matching SKU", async () => {
    const first = await newTransfer(5);
    await complete(scopeB, first.id);
    const [source] = await db.select().from(item).where(eq(item.id, ITEM_A));
    expect(source.quantity).toBe(15);
    const [dest] = await db.select().from(item).where(and(eq(item.officeId, B), eq(item.sku, "CH-1")));
    expect(dest.quantity).toBe(5);
    expect(dest.categoryId).toBe(CAT_B);

    const second = await newTransfer(2);
    await complete(scopeB, second.id);
    expect((await db.select().from(item).where(eq(item.officeId, B))).length).toBe(1);
    const [updated] = await db.select().from(item).where(eq(item.id, dest.id));
    expect(updated.quantity).toBe(7);

    const moves = await db.select().from(stockMovement).where(eq(stockMovement.itemId, ITEM_A));
    expect(moves.map((m) => [m.type, m.delta])).toContainEqual(["transfer_out", -5]);
    const logs = await db.select().from(auditLog).where(eq(auditLog.entityId, first.id));
    expect(logs.map((l) => l.officeId).sort()).toEqual([A, B].sort());
  });

  it("can't be completed twice, or beyond the available stock", async () => {
    const row = await newTransfer(1);
    await complete(scopeB, row.id);
    expect(await failure(complete(scopeB, row.id))).toContain("transfer_not_pending");
    const tooMany = await newTransfer(9999);
    expect(await failure(complete(scopeB, tooMany.id))).toContain("transfer_insufficient_stock");
    const [after] = await db.select().from(transfer).where(eq(transfer.id, tooMany.id));
    expect(after.status).toBe("pending");
    await db.update(transfer).set({ status: "cancelled" }).where(eq(transfer.id, tooMany.id));
  });

  it("announces a completed transfer to both offices, exactly once", async () => {
    const row = await newTransfer(1);
    await complete(scopeB, row.id);
    const event = { id: id("e1"), topic: "transfer.completed", payload: { transferId: row.id } };
    const first = await asWorker((tx) => handleEvent(tx, event));
    expect(first.sort()).toEqual([ADMIN_A, USER_A, ADMIN_B, USER_B].sort());
    expect(await asWorker((tx) => handleEvent(tx, event))).toEqual([]);
    const notes = await db.select().from(notification).where(eq(notification.dedupeKey, `transfer.completed:${row.id}`));
    expect(notes).toHaveLength(4);
    expect(notes[0].title).toBe("1 pcs of Chair was given to Office B");
    expect(notes[0].body).toContain("by Maria");
  });

  it("tells only the receiving admins about a new request", async () => {
    const row = await newTransfer(1);
    const notified = await asWorker((tx) => handleEvent(tx, { id: id("e2"), topic: "transfer.requested", payload: { transferId: row.id } }));
    expect(notified).toEqual([ADMIN_B]);
    await db.update(transfer).set({ status: "cancelled" }).where(eq(transfer.id, row.id));
  });
});

describe("assignments", () => {
  it("stays inside the office", async () => {
    const [row] = await db
      .insert(assignment)
      .values({ officeId: A, itemId: ITEM_A, assigneeId: USER_A, assignedBy: ADMIN_A, since: "2026-11-02" })
      .returning();
    await asApp(scopeB, async (tx) => expect(await tx.select().from(assignment)).toEqual([]));
    await asApp(scopeA, async (tx) => expect((await tx.select().from(assignment)).length).toBe(1));
    expect(
      await failure(asApp(scopeB, (tx) => tx.insert(assignment).values({ officeId: A, itemId: ITEM_A, assigneeId: USER_B, assignedBy: ADMIN_B, since: "2026-11-02" }))),
    ).not.toBeNull();

    const notified = await asWorker((tx) =>
      handleEvent(tx, { id: id("e3"), topic: "assignment.created", payload: { assignmentId: row.id, assigneeName: "Juan", assignedByName: "Maria" } }),
    );
    expect(notified.sort()).toEqual([ADMIN_A, USER_A].sort());
    const [note] = await db.select().from(notification).where(eq(notification.dedupeKey, `assignment.created:${row.id}`));
    expect(note.title).toBe("Chair was given to Juan");
    expect(note.body).toBe("Since 2 Nov 2026, by Maria.");
  });
});

describe("notifications", () => {
  it("are private to each person and only the worker creates them", async () => {
    const mine = await asApp(scopeUserA, (tx) => tx.select().from(notification));
    expect(mine.every((n) => n.userId === USER_A)).toBe(true);
    const anyDeveloper = await asApp(platform, (tx) => tx.select().from(notification));
    expect(anyDeveloper.every((n) => n.userId === DEV)).toBe(true);
    expect(
      await failure(asApp(platform, (tx) => tx.insert(notification).values({ userId: USER_A, kind: "x", title: "x", dedupeKey: "x" }))),
    ).not.toBeNull();
  });

  it("can only be marked by their owner, and only as read or acknowledged", async () => {
    const [note] = await db.select().from(notification).where(eq(notification.userId, USER_A)).limit(1);
    await asApp(scopeUserB, (tx) => tx.update(notification).set({ readAt: new Date() }).where(eq(notification.id, note.id)));
    expect((await db.select().from(notification).where(eq(notification.id, note.id)))[0].readAt).toBeNull();
    await asApp(scopeUserA, (tx) => tx.update(notification).set({ readAt: new Date() }).where(eq(notification.id, note.id)));
    expect((await db.select().from(notification).where(eq(notification.id, note.id)))[0].readAt).not.toBeNull();
    expect(await failure(asApp(scopeUserA, (tx) => tx.update(notification).set({ title: "changed" }).where(eq(notification.id, note.id))))).not.toBeNull();
  });
});

describe("announcements", () => {
  const make = async (values: Partial<typeof announcement.$inferInsert>) => {
    const [row] = await db
      .insert(announcement)
      .values({ audienceType: "all", title: "Hello", body: "Body", createdBy: DEV, ...values })
      .returning();
    return row;
  };
  const recipients = async (announcementId: string) =>
    (await db.select().from(notification).where(eq(notification.announcementId, announcementId))).map((n) => n.userId).sort();

  it("reaches everyone once, even if sending runs twice", async () => {
    const row = await make({});
    const first = await asWorker((tx) => sendAnnouncement(tx, row.id));
    expect(first).toHaveLength(5);
    expect(await asWorker((tx) => sendAnnouncement(tx, row.id))).toEqual([]);
    expect(await recipients(row.id)).toHaveLength(5);
  });

  it("can target chosen offices or a role", async () => {
    const office = await make({ audienceType: "offices", audienceOfficeIds: [A] });
    await asWorker((tx) => sendAnnouncement(tx, office.id));
    expect(await recipients(office.id)).toEqual([ADMIN_A, USER_A].sort());
    const role = await make({ audienceType: "role", audienceRole: "admin" });
    await asWorker((tx) => sendAnnouncement(tx, role.id));
    expect(await recipients(role.id)).toEqual([ADMIN_A, ADMIN_B].sort());
  });

  it("waits for its scheduled time", async () => {
    const later = await make({ scheduledAt: new Date(Date.now() + 3_600_000) });
    await asWorker((tx) => sendAnnouncement(tx, later.id));
    expect(await recipients(later.id)).toEqual([]);
    const due = await make({ scheduledAt: new Date(Date.now() - 1000) });
    const sent = await asWorker(dispatchAnnouncements);
    expect(sent.has(due.id)).toBe(true);
    expect(sent.has(later.id)).toBe(false);
    await db.update(announcement).set({ sentAt: new Date() }).where(eq(announcement.id, later.id));
  });

  it("keeps an office admin's list to their own office", async () => {
    await db.insert(announcement).values({ officeId: B, audienceType: "offices", audienceOfficeIds: [B], title: "B only", body: "x", createdBy: ADMIN_B, sentAt: new Date() });
    const seen = await asApp(scopeA, (tx) => tx.select().from(announcement));
    expect(seen.find((a) => a.title === "B only")).toBeUndefined();
    expect(
      await failure(asApp(scopeA, (tx) => tx.insert(announcement).values({ officeId: B, audienceType: "all", title: "x", body: "x", createdBy: ADMIN_A }))),
    ).not.toBeNull();
  });
});

describe("reminders", () => {
  it("flags low stock once a day, for admins only", async () => {
    await db.update(item).set({ reorderLevel: 999 }).where(eq(item.id, ITEM_A));
    const now = new Date("2026-11-02T08:00:00Z");
    await asWorker((tx) => scanReminders(tx, now));
    expect(await asWorker((tx) => scanReminders(tx, now))).not.toContain(ADMIN_A);
    const notes = await db.select().from(notification).where(eq(notification.dedupeKey, `low_stock:${ITEM_A}:2026-11-02`));
    expect(notes.map((n) => n.userId)).toEqual([ADMIN_A]);
    await db.update(item).set({ reorderLevel: null }).where(eq(item.id, ITEM_A));
  });

  it("marks overdue returns urgent", async () => {
    const [row] = await db
      .insert(assignment)
      .values({ officeId: A, itemId: ITEM_A, assigneeId: USER_A, assignedBy: ADMIN_A, since: "2026-01-01", dueAt: "2026-10-01" })
      .returning();
    await asWorker((tx) => scanReminders(tx, new Date("2026-11-03T08:00:00Z")));
    const notes = await db.select().from(notification).where(eq(notification.dedupeKey, `return:${row.id}:2026-11-03`));
    expect(notes.length).toBe(2);
    expect(notes[0].urgent).toBe(true);
    expect(notes[0].title).toBe("Chair is overdue");
  });
});

describe("audit hash chain", () => {
  it("passes when untouched, and catches an edit made around the safeguards", async () => {
    await db.insert(auditLog).values({ action: "test.one" });
    expect(await asWorker(checkpointAudit)).not.toBeNull();
    await db.insert(auditLog).values({ action: "test.two" });
    await asWorker(checkpointAudit);
    expect((await asWorker(verifyAudit)).ok).toBe(true);
    expect(await asWorker(checkpointAudit)).toBeNull();

    // An attacker with database owner rights disables the trigger and rewrites history.
    await client.exec(`
      alter table audit_log disable trigger audit_log_append_only;
      update audit_log set action = 'test.tampered' where action = 'test.one';
      alter table audit_log enable trigger audit_log_append_only;
    `);
    const result = await asWorker(verifyAudit);
    expect(result.ok).toBe(false);
    expect(result.alerted).toContain(DEV);
    const [note] = await db.select().from(notification).where(and(eq(notification.userId, DEV), eq(notification.kind, "security")));
    expect(note.urgent).toBe(true);
    expect((await db.select().from(auditCheckpoint)).length).toBeGreaterThan(0);
  });
});

describe("office directory", () => {
  it("shares office names and nothing more", async () => {
    const result = (await asApp(scopeA, (tx) => tx.execute(sql`select * from office_directory()`))) as unknown as { rows: Record<string, unknown>[] };
    expect(result.rows).toEqual(expect.arrayContaining([{ id: A, name: "Office A" }, { id: B, name: "Office B" }]));
  });
});
