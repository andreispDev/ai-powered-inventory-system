import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { appUser, category, categoryField, item, office, permissionGrant, stockMovement } from "@/server/db/schema";
import { runScoped, type Scope, type ScopedTx } from "@/server/db/scope";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const [A, B] = [id("a"), id("b")];
const [ADMIN_A, ADMIN_B, DEV] = [id("a1"), id("b1"), id("d1")];
const [FOLDER_A, TABLE_A, TABLE_B, ITEM_A, ITEM_B] = [id("fa"), id("ca"), id("cb"), id("ea"), id("eb")];

const scopeA: Scope = { kind: "office", officeId: A, userId: ADMIN_A };
const platform: Scope = { kind: "platform", userId: DEV };

let db: ReturnType<typeof drizzle<typeof schema>>;

const asApp = <T>(scope: Scope, fn: (tx: ScopedTx) => Promise<T>): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local role inventory_app`);
    return runScoped(tx as never, scope, fn);
  });

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: Error & { cause?: Error }) => e.cause?.message ?? e.message,
  );

const purge = (scope: Scope, categories: boolean) => asApp(scope, (tx) => tx.execute(sql`select purge_office_data(${categories}) as removed`));

const approve = (userId: string, officeId: string) =>
  db.insert(permissionGrant).values({ subjectType: "user", subjectId: userId, officeId, permission: "data.purge", effect: "allow", reason: "test", grantedBy: DEV });

const countIn = async (table: typeof item | typeof category, officeId: string) => (await db.select().from(table).where(eq(table.officeId, officeId))).length;

beforeAll(async () => {
  db = drizzle(new PGlite({ extensions: { vector } }), { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await db.insert(office).values([
    { id: A, code: "A", name: "Office A" },
    { id: B, code: "B", name: "Office B" },
  ]);
  await db.insert(appUser).values([
    { id: ADMIN_A, name: "Maria", email: "ma@e.test", role: "admin", officeId: A },
    { id: ADMIN_B, name: "Bea", email: "mb@e.test", role: "admin", officeId: B },
    { id: DEV, name: "Dev", email: "d@e.test", role: "developer" },
  ]);
  await db.insert(category).values([
    { id: FOLDER_A, officeId: A, name: "Network", isFolder: true },
    { id: TABLE_A, officeId: A, name: "Asus", parentId: FOLDER_A },
    { id: TABLE_B, officeId: B, name: "Asus" },
  ]);
  await db.insert(categoryField).values({ officeId: A, categoryId: TABLE_A, key: "serial", label: "Serial", type: "text", position: 1 });
  await db.insert(item).values([
    { id: ITEM_A, officeId: A, categoryId: TABLE_A, name: "VG249", quantity: 3, createdBy: ADMIN_A },
    { id: ITEM_B, officeId: B, categoryId: TABLE_B, name: "VG249", quantity: 3 },
  ]);
  await db.insert(stockMovement).values([
    { officeId: A, itemId: ITEM_A, type: "receive", delta: 3, balanceAfter: 3, reason: "Initial stock", actorId: ADMIN_A },
    { officeId: B, itemId: ITEM_B, type: "receive", delta: 3, balanceAfter: 3, reason: "Initial stock", actorId: ADMIN_B },
  ]);
});

describe("deleting an office's data", () => {
  it("is refused without a Developer's approval, and for accounts outside an office", async () => {
    expect(await failure(purge(scopeA, false))).toContain("purge_not_approved");
    expect(await failure(purge(platform, false))).toContain("purge_not_allowed");
    expect(await countIn(item, A)).toBe(1);
  });

  it("can't be done by deleting rows directly", async () => {
    expect(await failure(asApp(scopeA, (tx) => tx.delete(item).where(eq(item.id, ITEM_A))))).not.toBeNull();
    // Stock history stays append-only outside the purge, even for the table owner.
    expect(await failure(db.delete(stockMovement).where(eq(stockMovement.itemId, ITEM_A)))).toContain("append-only");
  });

  it("removes only this office's rows, keeps its categories, and uses up the approval", async () => {
    await approve(ADMIN_A, A);
    const result = (await purge(scopeA, false)) as unknown as { rows: { removed: { items: number; categories: number } }[] };
    expect(result.rows[0].removed).toEqual({ items: 1, categories: 0 });
    expect(await countIn(item, A)).toBe(0);
    expect(await countIn(category, A)).toBe(2);
    expect((await db.select().from(stockMovement).where(eq(stockMovement.officeId, A))).length).toBe(0);
    // Office B is untouched.
    expect(await countIn(item, B)).toBe(1);
    expect((await db.select().from(stockMovement).where(eq(stockMovement.officeId, B))).length).toBe(1);
    // One approval, one purge.
    expect(await failure(purge(scopeA, false))).toContain("purge_not_approved");
  });

  it("removes every category and column when asked to", async () => {
    await approve(ADMIN_A, A);
    await purge(scopeA, true);
    expect(await countIn(category, A)).toBe(0);
    expect((await db.select().from(categoryField).where(eq(categoryField.officeId, A))).length).toBe(0);
    expect(await countIn(category, B)).toBe(1);
  });

  it("doesn't accept another office's approval", async () => {
    await approve(ADMIN_B, B);
    expect(await failure(purge(scopeA, false))).toContain("purge_not_approved");
    expect(await countIn(item, B)).toBe(1);
  });
});
