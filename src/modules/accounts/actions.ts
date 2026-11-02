"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEmailChangedNotice } from "@/server/auth/mailer";
import { getAuthDb } from "@/server/db/client";
import { appUser, office, session } from "@/server/db/schema";
import { AppError, isUniqueViolation } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";

const notFound = () => new AppError("NOT_FOUND", "This account no longer exists.");

export const createAccount = guard({
  permission: "user.create",
  input: z.object({
    name: z.string().trim().min(2, "Enter the person's name.").max(120),
    email: z.email("Enter a valid email address.").transform((email) => email.trim().toLowerCase()),
    role: z.enum(["admin", "user"]),
    officeId: z.uuid().optional(),
  }),
  run: async ({ input, tx, actor, audit }) => {
    if (input.role === "admin" && !actor.permissions.includes("admin.create")) {
      throw new AppError("FORBIDDEN", "Only a Developer can create admin accounts.");
    }
    // Office staff can only add people to their own office, whatever the form sends.
    const officeId = actor.officeId ?? input.officeId;
    if (!officeId) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { officeId: ["Choose an office."] });
    }
    const [target] = await tx.select({ status: office.status }).from(office).where(eq(office.id, officeId));
    if (!target) throw new AppError("NOT_FOUND", "This office no longer exists.");
    if (target.status !== "active") throw new AppError("CONFLICT", "This office is archived.");

    let row;
    try {
      [row] = await tx
        .insert(appUser)
        .values({ name: input.name, email: input.email, role: input.role, officeId })
        .returning({ id: appUser.id });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("VALIDATION", "Please check the highlighted fields.", {
          email: ["This email already has an account."],
        });
      }
      throw error;
    }
    await audit({
      action: "user.created",
      entityType: "app_user",
      entityId: row.id,
      officeId,
      after: { name: input.name, email: input.email, role: input.role },
    });
    revalidatePath("/accounts");
    revalidatePath(`/console/offices/${officeId}`);
    return { id: row.id };
  },
});

/** Admins edit users in their own office, and Developers edit anyone. Nobody edits themselves here. */
export const updateAccount = guard({
  permission: "user.manage",
  input: z.object({
    id: z.uuid(),
    name: z.string().trim().min(2, "Enter the person's name.").max(120),
    email: z.email("Enter a valid email address.").transform((email) => email.trim().toLowerCase()),
  }),
  run: async ({ input: { id, name, email }, tx, actor, audit }) => {
    const [target] = await tx.select().from(appUser).where(eq(appUser.id, id));
    if (!target) throw notFound();
    if (id === actor.id) throw new AppError("FORBIDDEN", "You can't change your own account here.");
    // The email is how someone signs in, so editing it could take over the account. Never upward.
    if (target.role !== "user" && actor.role !== "developer") {
      throw new AppError("FORBIDDEN", "Only a Developer can change this account.");
    }
    const emailChanged = email !== target.email;
    try {
      await tx
        .update(appUser)
        .set({
          name,
          email,
          // The new address isn't proven until they sign in with it.
          ...(emailChanged ? { emailVerified: false, status: target.status === "deactivated" ? target.status : ("invited" as const) } : {}),
        })
        .where(eq(appUser.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("VALIDATION", "Please check the highlighted fields.", {
          email: ["This email already has an account."],
        });
      }
      throw error;
    }
    await audit({
      action: emailChanged ? "user.email_changed" : "user.updated",
      entityType: "app_user",
      entityId: id,
      officeId: target.officeId,
      before: { name: target.name, email: target.email },
      after: { name, email },
    });
    if (emailChanged) {
      await getAuthDb().delete(session).where(eq(session.userId, id));
      // A failed notice shouldn't undo the change. It's on the record either way.
      await sendEmailChangedNotice(target.email).catch((error) => console.error("Email change notice:", String(error)));
    }
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${id}`);
    return { id };
  },
});

export const setAccountActive = guard({
  permission: "user.manage",
  input: z.object({ id: z.uuid(), active: z.boolean() }),
  run: async ({ input: { id, active }, tx, actor, audit }) => {
    const [target] = await tx.select().from(appUser).where(eq(appUser.id, id));
    if (!target) throw notFound();
    if (id === actor.id) throw new AppError("FORBIDDEN", "You can't change your own account status.");
    if (target.role !== "user" && actor.role !== "developer") {
      throw new AppError("FORBIDDEN", "Only a Developer can change this account.");
    }
    if (!active && target.role === "developer") {
      const [{ others }] = await tx
        .select({ others: count() })
        .from(appUser)
        .where(and(eq(appUser.role, "developer"), eq(appUser.status, "active"), ne(appUser.id, id)));
      if (others === 0) throw new AppError("CONFLICT", "The last active Developer can't be deactivated.");
    }
    // Deactivating takes effect on the person's next request, because every request checks status.
    const status = active
      ? sql`case when ${appUser.emailVerified} then 'active'::user_status else 'invited'::user_status end`
      : sql`'deactivated'::user_status`;
    await tx.update(appUser).set({ status }).where(eq(appUser.id, id));
    await audit({
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "app_user",
      entityId: id,
      officeId: target.officeId,
      before: { status: target.status },
    });
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${id}`);
    return { id };
  },
});
