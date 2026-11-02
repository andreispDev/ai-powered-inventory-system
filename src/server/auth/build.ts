import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";
import { account, appUser, auditLog, session, verification } from "../db/schema";
import { canStartSession, normalizeEmail } from "./sign-in-rules";

const SEND_PATH = "/email-otp/send-verification-otp";
const SIGN_IN_PATH = "/sign-in/email-otp";

export type AuthDeps = {
  db: PgDatabase<PgQueryResultHKT, typeof schema>;
  secret: string;
  baseURL: string;
  sendCode: (email: string, code: string) => Promise<void>;
  /** Limits codes per email, whichever IP address asks */
  allowCodeRequest: (email: string) => Promise<boolean>;
};

/** Sign-in is by emailed one-time code, and only for accounts that were created in advance. */
export function buildAuth({ db, secret, baseURL, sendCode, allowCodeRequest }: AuthDeps) {
  const log = (action: string, email: string | undefined, reason?: string) =>
    db.insert(auditLog).values({
      action,
      entityType: "email",
      entityId: email,
      after: reason ? { reason } : undefined,
    });

  const findByEmail = async (email: string) => {
    const [user] = await db
      .select()
      .from(appUser)
      .where(eq(sql`lower(${appUser.email})`, normalizeEmail(email)));
    return user;
  };

  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: appUser, session, account, verification },
    }),
    advanced: { database: { generateId: "uuid" } },
    plugins: [
      emailOTP({
        // Unknown emails get the same response and no email, so no one can test who has an account.
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        storeOTP: "hashed",
        rateLimit: { window: 60, max: 3 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          const user = await findByEmail(email);
          if (user?.status === "deactivated") return;
          await sendCode(email, otp);
        },
      }),
    ],
    rateLimit: { enabled: true },
    // Ends after 8 idle hours. The 7-day limit is checked in session.ts.
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SEND_PATH) return;
        const email = String(ctx.body?.email ?? "");
        if (ctx.body?.type !== "sign-in") {
          throw new APIError("FORBIDDEN", { message: "Not available." });
        }
        if (!(await allowCodeRequest(normalizeEmail(email)))) {
          await log("auth.code_limit_reached", normalizeEmail(email));
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes requested. Try again later." });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = normalizeEmail(String(ctx.body?.email ?? ""));
        const failed = ctx.context.returned instanceof Error;
        await log(failed ? "auth.sign_in_failed" : "auth.signed_in", email);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // A second lock on "accounts are created in advance".
          before: async () => false,
        },
      },
      session: {
        create: {
          before: async (data) => {
            const [user] = await db.select().from(appUser).where(eq(appUser.id, data.userId));
            if (!canStartSession(user)) return false;
            if (user.status === "invited") {
              await db.update(appUser).set({ status: "active" }).where(eq(appUser.id, user.id));
            }
            return { data };
          },
        },
      },
    },
  });
}
