import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAttributesSchema, fieldChangeProblem, keyFromLabel, type FieldDef } from "@/modules/categories/field-schema";
import { deltaOf, movementSchema } from "@/modules/inventory/schemas";
import * as schema from "@/server/db/schema";
import { appUser, category, categoryField, idempotencyKey, item, office, stockMovement } from "@/server/db/schema";
import { runScoped, type Scope, type ScopedTx } from "@/server/db/scope";
import { parsePage } from "@/lib/pagination";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const USER_A = "00000000-0000-4000-8000-0000000000a1";
const USER_B = "00000000-0000-4000-8000-0000000000b1";
const DEV = "00000000-0000-4000-8000-0000000000d1";
const CAT_A = "00000000-0000-4000-8000-0000000000ca";
const CAT_B = "00000000-0000-4000-8000-0000000000cb";
const ITEM_B = "00000000-0000-4000-8000-0000000000eb";

const scopeA: Scope = { kind: "office", officeId: A, userId: USER_A };
const scopeB: Scope = { kind: "office", officeId: B, userId: USER_B };
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
    (e: Error) => e,
  );

beforeAll(async () => {
  db = drizzle(new PGlite({ extensions: { vector } }), { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await db.insert(office).values([
    { id: A, code: "A", name: "A" },
    { id: B, code: "B", name: "B" },
  ]);
  await db.insert(appUser).values([
    { id: USER_A, name: "a", email: "a@example.test", role: "user", officeId: A },
    { id: USER_B, name: "b", email: "b@example.test", role: "user", officeId: B },
    { id: DEV, name: "d", email: "d@example.test", role: "developer" },
  ]);
  await db.insert(category).values([
    { id: CAT_A, officeId: A, name: "Laptops" },
    { id: CAT_B, officeId: B, name: "Chairs" },
  ]);
  await db.insert(categoryField).values({ officeId: B, categoryId: CAT_B, key: "color", label: "Color", type: "text", position: 1 });
  await db.insert(item).values({ id: ITEM_B, officeId: B, categoryId: CAT_B, name: "Chair", quantity: 5 });
  await db.insert(stockMovement).values({ officeId: B, itemId: ITEM_B, type: "receive", delta: 5, balanceAfter: 5, reason: "start", actorId: USER_B });
});

describe("inventory separation", () => {
  it("hides every inventory table from other offices", async () => {
    await asApp(scopeA, async (tx) => {
      expect((await tx.select().from(category)).map((c) => c.id)).toEqual([CAT_A]);
      expect(await tx.select().from(categoryField)).toEqual([]);
      expect(await tx.select().from(item)).toEqual([]);
      expect(await tx.select().from(stockMovement)).toEqual([]);
    });
  });

  it("can't read another office's item by ID", async () => {
    await asApp(scopeA, async (tx) => {
      expect(await tx.select().from(item).where(eq(item.id, ITEM_B))).toEqual([]);
    });
  });

  it("changes nothing when updating another office's item", async () => {
    await asApp(scopeA, (tx) => tx.update(item).set({ name: "stolen", quantity: 0 }).where(eq(item.id, ITEM_B)));
    const [row] = await db.select().from(item).where(eq(item.id, ITEM_B));
    expect(row.name).toBe("Chair");
    expect(row.quantity).toBe(5);
  });

  it("rejects creating records in another office", async () => {
    expect(await failure(asApp(scopeA, (tx) => tx.insert(category).values({ officeId: B, name: "x" })))).not.toBeNull();
    expect(await failure(asApp(scopeA, (tx) => tx.insert(item).values({ officeId: B, categoryId: CAT_B, name: "x" })))).not.toBeNull();
  });

  it("rejects moving your item into another office's category", async () => {
    expect(await failure(asApp(scopeA, (tx) => tx.insert(item).values({ officeId: A, categoryId: CAT_B, name: "x" })))).not.toBeNull();
  });

  it("lets Developers read every office but write none", async () => {
    await asApp(platform, async (tx) => {
      expect(await tx.select().from(item)).toHaveLength(1);
      expect(await tx.select().from(category)).toHaveLength(2);
    });
    expect(await failure(asApp(platform, (tx) => tx.insert(category).values({ officeId: A, name: "dev" })))).not.toBeNull();
    await asApp(platform, (tx) => tx.update(item).set({ name: "dev" }).where(eq(item.id, ITEM_B)));
    expect((await db.select().from(item).where(eq(item.id, ITEM_B)))[0].name).toBe("Chair");
  });

  it("keeps retry keys private to each person", async () => {
    await asApp(scopeB, (tx) => tx.insert(idempotencyKey).values({ userId: USER_B, key: "k1" }));
    await asApp(scopeA, async (tx) => expect(await tx.select().from(idempotencyKey)).toEqual([]));
    expect(await failure(asApp(scopeA, (tx) => tx.insert(idempotencyKey).values({ userId: USER_B, key: "k2" })))).not.toBeNull();
  });
});

describe("stock integrity", () => {
  it("never allows negative stock", async () => {
    expect(await failure(asApp(scopeB, (tx) => tx.update(item).set({ quantity: -1 }).where(eq(item.id, ITEM_B))))).not.toBeNull();
  });

  it("can't edit or delete stock history, even as the owner", async () => {
    expect(await failure(asApp(scopeB, (tx) => tx.delete(stockMovement)))).not.toBeNull();
    expect(await failure(db.update(stockMovement).set({ reason: "edited" }))).not.toBeNull();
    expect(await failure(db.delete(stockMovement))).not.toBeNull();
  });

  it("works out the change from the movement type", () => {
    expect(deltaOf("receive", 5)).toBe(5);
    expect(deltaOf("issue", 5)).toBe(-5);
    expect(deltaOf("return", 2)).toBe(2);
    expect(deltaOf("adjust", -3)).toBe(-3);
  });

  it("requires a positive amount except for adjustments", () => {
    const base = { itemId: ITEM_B, reason: "counted" };
    expect(movementSchema.safeParse({ ...base, type: "issue", amount: -1 }).success).toBe(false);
    expect(movementSchema.safeParse({ ...base, type: "receive", amount: 0 }).success).toBe(false);
    expect(movementSchema.safeParse({ ...base, type: "adjust", amount: -1 }).success).toBe(true);
    expect(movementSchema.safeParse({ ...base, type: "adjust", amount: 0 }).success).toBe(false);
  });
});

describe("custom columns", () => {
  const fields: FieldDef[] = [
    { key: "ram", label: "RAM", type: "integer", config: { required: true, min: 1, max: 256, unit: "GB" } },
    { key: "os", label: "OS", type: "select", config: { options: ["Windows", "Linux"] } },
    { key: "tags", label: "Tags", type: "multi_select", config: { options: ["a", "b"] } },
    { key: "link", label: "Link", type: "url", config: {} },
    { key: "bought", label: "Bought", type: "date", config: {} },
    { key: "asset", label: "Asset", type: "text", config: { pattern: "^AT-[0-9]+$" } },
    { key: "ok", label: "OK", type: "boolean", config: {} },
  ];
  const schemaFor = buildAttributesSchema(fields);

  it("accepts valid values and drops unknown keys", () => {
    const result = schemaFor.parse({ ram: 16, os: "Linux", tags: ["a"], ok: false, hacker: "x" });
    expect(result).toEqual({ ram: 16, os: "Linux", tags: ["a"], ok: false });
  });

  it("enforces required, type, range, choices, links, dates and format", () => {
    const issues = (value: Record<string, unknown>) => schemaFor.safeParse(value).error?.issues.map((i) => String(i.path[0]));
    expect(issues({})).toEqual(["ram"]);
    expect(issues({ ram: "16" })).toEqual(["ram"]);
    expect(issues({ ram: 1.5 })).toEqual(["ram"]);
    expect(issues({ ram: 999 })).toEqual(["ram"]);
    expect(issues({ ram: 8, os: "Mac" })).toEqual(["os"]);
    expect(issues({ ram: 8, tags: ["z"] })).toEqual(["tags"]);
    expect(issues({ ram: 8, link: "javascript:alert(1)" })).toEqual(["link"]);
    expect(issues({ ram: 8, bought: "yesterday" })).toEqual(["bought"]);
    expect(issues({ ram: 8, asset: "bad" })).toEqual(["asset"]);
  });

  it("makes stable, safe, unique keys", () => {
    expect(keyFromLabel("Warranty end!", [])).toBe("warranty_end");
    expect(keyFromLabel("RAM", ["ram"])).toBe("ram_2");
    expect(keyFromLabel("9 lives", [])).toBe("f_9_lives");
    expect(keyFromLabel("'; drop table item; --", [])).toBe("drop_table_item");
    expect(keyFromLabel("!!!", [])).toBe("field");
  });

  it("blocks column changes that would break existing data", () => {
    const os = fields[1];
    expect(fieldChangeProblem(os, { options: ["Windows"] }, ["Linux"])).toContain("Linux");
    expect(fieldChangeProblem(os, { options: ["Windows", "Linux", "Mac"] }, ["Linux"])).toBeNull();
    expect(fieldChangeProblem(fields[0], { min: 8 }, [4])).toContain("minimum");
    expect(fieldChangeProblem(fields[0], { max: 8 }, [16])).toContain("maximum");
  });
});

describe("pagination", () => {
  it("falls back safely on bad input and caps deep pages", () => {
    expect(parsePage({})).toEqual({ page: 1, pageSize: 25, offset: 0 });
    expect(parsePage({ page: "-4", size: "9999" })).toEqual({ page: 1, pageSize: 25, offset: 0 });
    expect(parsePage({ page: "abc", size: "50" })).toEqual({ page: 1, pageSize: 50, offset: 0 });
    expect(parsePage({ page: "999999", size: "100" }).offset).toBe(10_000);
  });
});
