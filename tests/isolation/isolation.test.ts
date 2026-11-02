import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { writeAudit } from "@/server/audit/writer";
import * as schema from "@/server/db/schema";
import { appUser, auditLog, office, outbox, permissionGrant } from "@/server/db/schema";
import { runScoped, type Scope, type ScopedTx } from "@/server/db/scope";

const OFFICE_A = "00000000-0000-4000-8000-00000000000a";
const OFFICE_B = "00000000-0000-4000-8000-00000000000b";
const USER_A = "00000000-0000-4000-8000-0000000000a1";
const USER_B = "00000000-0000-4000-8000-0000000000b1";
const DEVELOPER = "00000000-0000-4000-8000-0000000000d1";

const scopeA: Scope = { kind: "office", officeId: OFFICE_A, userId: USER_A };
const scopeB: Scope = { kind: "office", officeId: OFFICE_B, userId: USER_B };
const platform: Scope = { kind: "platform", userId: DEVELOPER };

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

/** Runs as the restricted app role, the way the real app connects. */
const asApp = <T>(scope: Scope | null, fn: (tx: ScopedTx) => Promise<T>): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local role inventory_app`);
    if (!scope) return fn(tx as unknown as ScopedTx);
    return runScoped(tx as never, scope, fn);
  });

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: Error) => e,
  );

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });

  await db.insert(office).values([
    { id: OFFICE_A, code: "A", name: "Office A" },
    { id: OFFICE_B, code: "B", name: "Office B" },
  ]);
  await db.insert(appUser).values([
    { id: USER_A, name: "A", email: "a@example.test", role: "user", officeId: OFFICE_A },
    { id: USER_B, name: "B", email: "b@example.test", role: "user", officeId: OFFICE_B },
    { id: DEVELOPER, name: "D", email: "d@example.test", role: "developer" },
  ]);
  await db.insert(permissionGrant).values([
    { subjectType: "office", subjectId: OFFICE_B, officeId: OFFICE_B, permission: "item.read", effect: "deny", reason: "t", grantedBy: DEVELOPER },
  ]);
  await db.insert(auditLog).values({ officeId: OFFICE_B, actorId: USER_B, action: "seed" });
});

describe("every table holding office data", () => {
  it("has row-level security forced on", async () => {
    const { rows } = await client.query<{ table_name: string; forced: boolean }>(`
      select c.table_name, cls.relforcerowsecurity as forced
      from information_schema.columns c
      join pg_class cls on cls.relname = c.table_name
      where c.table_schema = 'public' and c.column_name = 'office_id'`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.forced)).toEqual([]);
  });
});

describe("office separation", () => {
  it("returns no rows at all when no scope is set", async () => {
    await asApp(null, async (tx) => {
      expect(await tx.select().from(office)).toEqual([]);
      expect(await tx.select().from(appUser)).toEqual([]);
      expect(await tx.select().from(auditLog)).toEqual([]);
    });
  });

  it("shows an office only its own rows", async () => {
    await asApp(scopeA, async (tx) => {
      expect((await tx.select().from(office)).map((o) => o.id)).toEqual([OFFICE_A]);
      expect((await tx.select().from(appUser)).map((u) => u.id)).toEqual([USER_A]);
      expect(await tx.select().from(permissionGrant)).toEqual([]);
      expect(await tx.select().from(auditLog)).toEqual([]);
    });
  });

  it("can't read another office's record by ID", async () => {
    await asApp(scopeA, async (tx) => {
      expect(await tx.select().from(appUser).where(eq(appUser.id, USER_B))).toEqual([]);
    });
  });

  it("silently changes nothing when updating another office's user", async () => {
    await asApp(scopeA, (tx) => tx.update(appUser).set({ name: "hacked" }).where(eq(appUser.id, USER_B)));
    const [row] = await db.select().from(appUser).where(eq(appUser.id, USER_B));
    expect(row.name).toBe("B");
  });

  it("rejects creating a user in another office", async () => {
    const error = await failure(
      asApp(scopeA, (tx) =>
        tx.insert(appUser).values({ name: "x", email: "x@example.test", role: "user", officeId: OFFICE_B }),
      ),
    );
    expect(error).not.toBeNull();
  });

  it("rejects moving your own office's user into another office", async () => {
    const error = await failure(
      asApp(scopeA, (tx) => tx.update(appUser).set({ officeId: OFFICE_B }).where(eq(appUser.id, USER_A))),
    );
    expect(error).not.toBeNull();
  });

  it("rejects writing audit entries or events for another office", async () => {
    expect(
      await failure(asApp(scopeA, (tx) => tx.insert(auditLog).values({ officeId: OFFICE_B, action: "fake" }))),
    ).not.toBeNull();
    expect(
      await failure(asApp(scopeA, (tx) => tx.insert(outbox).values({ officeId: OFFICE_B, topic: "t", payload: {} }))),
    ).not.toBeNull();
  });

  it("doesn't let offices change their own permissions or create offices", async () => {
    expect(
      await failure(
        asApp(scopeA, (tx) =>
          tx.insert(permissionGrant).values({
            subjectType: "user",
            subjectId: USER_A,
            officeId: OFFICE_A,
            permission: "office.manage",
            effect: "allow",
            reason: "self",
            grantedBy: USER_A,
          }),
        ),
      ),
    ).not.toBeNull();
    expect(await failure(asApp(scopeA, (tx) => tx.insert(office).values({ code: "X", name: "X" })))).not.toBeNull();
  });

  it("doesn't carry a scope over to the next transaction", async () => {
    await asApp(scopeA, (tx) => tx.select().from(office));
    await asApp(null, async (tx) => expect(await tx.select().from(office)).toEqual([]));
  });

  it("lets platform scope see every office", async () => {
    await asApp(platform, async (tx) => {
      expect(await tx.select().from(office)).toHaveLength(2);
      expect(await tx.select().from(appUser)).toHaveLength(3);
    });
  });

  it("isolates office B the same way", async () => {
    await asApp(scopeB, async (tx) => {
      expect((await tx.select().from(office)).map((o) => o.id)).toEqual([OFFICE_B]);
      expect(await tx.select().from(permissionGrant)).toHaveLength(1);
    });
  });
});

describe("audit log", () => {
  const actor = { id: USER_A, role: "user" as const, officeId: OFFICE_A };

  it("saves an entry with its change", async () => {
    await asApp(scopeA, (tx) => writeAudit(tx, { actor, action: "item.created", after: { name: "Chair" } }));
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "item.created"));
    expect(rows).toHaveLength(1);
    expect(rows[0].officeId).toBe(OFFICE_A);
  });

  it("loses the entry if the change fails", async () => {
    await failure(
      asApp(scopeA, async (tx) => {
        await writeAudit(tx, { actor, action: "item.rolled_back" });
        throw new Error("change failed");
      }),
    );
    expect(await db.select().from(auditLog).where(eq(auditLog.action, "item.rolled_back"))).toEqual([]);
  });

  it("can't be edited or deleted by the app", async () => {
    expect(await failure(asApp(platform, (tx) => tx.update(auditLog).set({ action: "edited" })))).not.toBeNull();
    expect(await failure(asApp(platform, (tx) => tx.delete(auditLog)))).not.toBeNull();
  });

  it("can't be edited or deleted even by the database owner", async () => {
    expect(await failure(db.update(auditLog).set({ action: "edited" }))).not.toBeNull();
    expect(await failure(db.delete(auditLog))).not.toBeNull();
  });
});

describe("account rules", () => {
  it("requires developers to have no office, and others to have one", async () => {
    expect(
      await failure(db.insert(appUser).values({ name: "x", email: "y@example.test", role: "user" })),
    ).not.toBeNull();
    expect(
      await failure(
        db.insert(appUser).values({ name: "x", email: "z@example.test", role: "developer", officeId: OFFICE_A }),
      ),
    ).not.toBeNull();
  });

  it("gives the app role no access to sign-in tables", async () => {
    expect(await failure(asApp(platform, (tx) => tx.select().from(schema.session)))).not.toBeNull();
    expect(await failure(asApp(platform, (tx) => tx.select().from(schema.account)))).not.toBeNull();
  });
});
