"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEverHold, PERMISSIONS, type Permission } from "@/server/authz/catalog";
import { appUser, office, permissionGrant } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";
import { AppError } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";

const subjectSchema = z.object({
  subjectType: z.enum(["user", "office"]),
  subjectId: z.uuid(),
  permission: z.string().refine((value) => PERMISSIONS.includes(value as Permission), "Unknown permission."),
});

/** Finds the office and the people a rule affects. */
async function resolve(tx: ScopedTx, subjectType: "user" | "office", subjectId: string) {
  if (subjectType === "user") {
    const [person] = await tx.select().from(appUser).where(eq(appUser.id, subjectId));
    if (!person) throw new AppError("NOT_FOUND", "This account no longer exists.");
    if (!person.officeId) throw new AppError("CONFLICT", "Developers have every platform permission already.");
    return { officeId: person.officeId, role: person.role, userIds: [person.id] };
  }
  const [target] = await tx.select({ id: office.id }).from(office).where(eq(office.id, subjectId));
  if (!target) throw new AppError("NOT_FOUND", "This office no longer exists.");
  const people = await tx
    .select({ id: appUser.id })
    .from(appUser)
    .where(and(eq(appUser.officeId, subjectId), sql`${appUser.status} <> 'deactivated'`));
  return { officeId: subjectId, role: "admin" as const, userIds: people.map((person) => person.id) };
}

export const setGrant = guard({
  permission: "permission.grant",
  input: subjectSchema.extend({
    effect: z.enum(["allow", "deny"]),
    reason: z.string().trim().min(3, "Say why, so the record makes sense later.").max(300),
    expiresAt: z
      .union([z.literal(""), z.iso.date("Enter a valid date.")])
      .transform((value) => (value ? new Date(`${value}T23:59:59`) : null)),
  }),
  run: async ({ input, tx, actor, audit, emit }) => {
    const permission = input.permission as Permission;
    const { officeId, role, userIds } = await resolve(tx, input.subjectType, input.subjectId);
    if (!canEverHold(role, permission)) throw new AppError("FORBIDDEN", "This permission can't be given to this role.");
    if (input.expiresAt && input.expiresAt < new Date()) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { expiresAt: ["Choose a future date."] });
    }
    const values = {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      officeId,
      permission,
      effect: input.effect,
      reason: input.reason,
      expiresAt: input.expiresAt,
      grantedBy: actor.id,
    };
    await tx
      .insert(permissionGrant)
      .values(values)
      .onConflictDoUpdate({
        target: [permissionGrant.subjectType, permissionGrant.subjectId, permissionGrant.permission],
        set: { effect: values.effect, reason: values.reason, expiresAt: values.expiresAt, grantedBy: values.grantedBy },
      });
    await audit({
      action: "permission.granted",
      entityType: input.subjectType,
      entityId: input.subjectId,
      officeId,
      after: { permission, effect: input.effect, reason: input.reason, expiresAt: input.expiresAt },
    });
    await emit("permission.changed", {
      userIds,
      summary: `${input.effect === "allow" ? "You can now use" : "You can no longer use"} ${permission}.`,
    });
    revalidatePath("/console/permissions");
    return { ok: true };
  },
});

export const clearGrant = guard({
  permission: "permission.grant",
  input: subjectSchema,
  run: async ({ input, tx, audit, emit }) => {
    const { officeId, userIds } = await resolve(tx, input.subjectType, input.subjectId);
    const match = and(
      eq(permissionGrant.subjectType, input.subjectType),
      eq(permissionGrant.subjectId, input.subjectId),
      eq(permissionGrant.permission, input.permission),
    );
    const [removed] = await tx.delete(permissionGrant).where(match).returning();
    if (!removed) throw new AppError("CONFLICT", "This rule has already been removed.");
    await audit({
      action: "permission.cleared",
      entityType: input.subjectType,
      entityId: input.subjectId,
      officeId,
      before: { permission: input.permission, effect: removed.effect, reason: removed.reason },
    });
    await emit("permission.changed", { userIds, summary: `Your access to ${input.permission} went back to your role's default.` });
    revalidatePath("/console/permissions");
    return { ok: true };
  },
});

