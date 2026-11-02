import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";
import { getAuthDb } from "../db/client";
import { account, appUser, auditLog, session, verification } from "../db/schema";
import { env } from "../env";
import { canLinkGoogle, canStartSession } from "./sign-in-rules";

function createAuth() {
  const db = getAuthDb();
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ALLOWED_HD } = env();

  const logDenied = (reason: string, entityId?: string) =>
    db.insert(auditLog).values({ action: "auth.sign_in_denied", entityType: "app_user", entityId, after: { reason } });

  return betterAuth({
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: appUser, session, account, verification },
    }),
    advanced: { database: { generateId: "uuid" } },
    socialProviders: {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        // Accounts are provisioned first, so sign-in never creates one.
        disableSignUp: true,
        hd: GOOGLE_ALLOWED_HD,
      },
    },
    // Google isn't a "trusted" provider here, so an unverified Google email can't link to an account.
    account: { accountLinking: { enabled: true } },
    // Ends after 8 idle hours. The 7-day limit is checked in session.ts.
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
    databaseHooks: {
      account: {
        create: {
          before: async (data) => {
            if (data.providerId !== "google") return false;
            const [existing] = await db
              .select({ sub: account.accountId })
              .from(account)
              .where(and(eq(account.userId, data.userId), eq(account.providerId, "google")));
            if (canLinkGoogle(existing?.sub, data.accountId)) return { data };
            await logDenied("google_identity_mismatch", data.userId);
            return false;
          },
        },
      },
      session: {
        create: {
          before: async (data) => {
            const [user] = await db.select().from(appUser).where(eq(appUser.id, data.userId));
            if (!canStartSession(user)) {
              await logDenied(user?.emailVerified === false ? "email_not_verified" : "account_inactive", data.userId);
              return false;
            }
            if (user.status === "invited") {
              await db.update(appUser).set({ status: "active" }).where(eq(appUser.id, user.id));
            }
            return { data };
          },
        },
      },
    },
    onAPIError: { errorURL: "/access-denied" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return (instance ??= createAuth());
}
