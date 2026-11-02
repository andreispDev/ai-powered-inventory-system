import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildAuth } from "@/server/auth/build";
import { canRequestCode } from "@/server/auth/sign-in-rules";
import * as schema from "@/server/db/schema";
import { appUser, auditLog, office, session, verification } from "@/server/db/schema";

const OFFICE = "00000000-0000-4000-8000-00000000000a";
const sent = new Map<string, string>();

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let auth: ReturnType<typeof buildAuth>;

const request = (email: string) =>
  auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
const signIn = (email: string, otp: string) => auth.api.signInEmailOTP({ body: { email, otp } });
/** The sign-in role can add to the log but not read it, so tests read as the owner. */
async function auditRows(action: string) {
  await client.exec("reset role");
  const rows = await db.select().from(auditLog).where(eq(auditLog.action, action));
  await client.exec("set role inventory_auth");
  return rows;
}

const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000");

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await db.insert(office).values({ id: OFFICE, code: "A", name: "Office A" });
  await db.insert(appUser).values([
    { name: "Invited", email: "invited@example.test", role: "user", officeId: OFFICE },
    { name: "Wrong", email: "wrong@example.test", role: "user", officeId: OFFICE },
    { name: "Gone", email: "gone@example.test", role: "user", officeId: OFFICE, status: "deactivated" },
    { name: "Late", email: "late@example.test", role: "user", officeId: OFFICE },
  ]);
  // Same restricted role the real sign-in connection uses.
  await client.exec("set role inventory_auth");
  auth = buildAuth({
    db,
    secret: "test-secret-test-secret-test-secret-1234",
    baseURL: "http://localhost:3000",
    sendCode: async (email, code) => void sent.set(email, code),
  });
});

beforeEach(() => sent.clear());

describe("email code sign-in", () => {
  it("signs in an invited account and activates it", async () => {
    await request("invited@example.test");
    const code = sent.get("invited@example.test");
    expect(code).toMatch(/^\d{6}$/);

    const result = await signIn("invited@example.test", code!);
    expect(result.token).toBeTruthy();

    const [user] = await db.select().from(appUser).where(eq(appUser.email, "invited@example.test"));
    expect(user.status).toBe("active");
    expect(user.emailVerified).toBe(true);
    expect(await auditRows("auth.signed_in")).toHaveLength(1);
  });

  it("stores codes hashed, never as sent", async () => {
    await request("late@example.test");
    const rows = await db.select().from(verification);
    expect(rows.some((row) => row.value.includes(sent.get("late@example.test")!))).toBe(false);
  });

  it("gives an unknown email the same response, with no email and no account", async () => {
    await expect(request("stranger@example.test")).resolves.toEqual({ success: true });
    expect(sent.size).toBe(0);
    await expect(signIn("stranger@example.test", "123456")).rejects.toThrow();
    expect(await db.select().from(appUser).where(eq(appUser.email, "stranger@example.test"))).toEqual([]);
  });

  it("doesn't send to or sign in a deactivated account", async () => {
    await expect(request("gone@example.test")).resolves.toEqual({ success: true });
    expect(sent.size).toBe(0);
    await expect(signIn("gone@example.test", "123456")).rejects.toThrow();
    const [user] = await db.select().from(appUser).where(eq(appUser.email, "gone@example.test"));
    expect(await db.select().from(session).where(eq(session.userId, user.id))).toEqual([]);
  });

  it("rejects a wrong code, logs it, and locks the code after 3 tries", async () => {
    await request("wrong@example.test");
    const code = sent.get("wrong@example.test")!;
    for (let i = 0; i < 3; i++) await expect(signIn("wrong@example.test", wrongCode(code))).rejects.toThrow();
    await expect(signIn("wrong@example.test", code)).rejects.toThrow();
    const failures = await auditRows("auth.sign_in_failed");
    expect(failures.length).toBeGreaterThanOrEqual(4);
  });

  it("refuses code types other than sign-in", async () => {
    await expect(
      auth.api.sendVerificationOTP({ body: { email: "invited@example.test", type: "forget-password" } }),
    ).rejects.toThrow();
    expect(sent.size).toBe(0);
  });
});

describe("code request limit", () => {
  it("allows 5 per email in 15 minutes, for any spelling of the address", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) expect(canRequestCode("Limit@Example.test", start + i)).toBe(true);
    expect(canRequestCode(" limit@example.test ", start + 10)).toBe(false);
    expect(canRequestCode("other@example.test", start + 10)).toBe(true);
    expect(canRequestCode("limit@example.test", start + 16 * 60 * 1000)).toBe(true);
  });
});
