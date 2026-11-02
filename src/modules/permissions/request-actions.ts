"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEverHold, PERMISSIONS, type Permission } from "@/server/authz/catalog";
import { permissionGrant, permissionRequest } from "@/server/db/schema";
import { AppError, isUniqueViolation } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";

export const requestPermission = guard({
  permission: "access.request",
  input: z.object({
    permission: z.string().refine((value) => PERMISSIONS.includes(value as Permission), "Choose a permission."),
    justification: z.string().trim().min(5, "Say why you need it.").max(300),
  }),
  run: async ({ input, tx, actor, audit, emit }) => {
    if (!actor.officeId) throw new AppError("FORBIDDEN", "Developers don't need to request access.");
    const permission = input.permission as Permission;
    if (actor.permissions.includes(permission)) throw new AppError("CONFLICT", "You already have this permission.");
    if (!canEverHold(actor.role, permission)) throw new AppError("FORBIDDEN", "This permission isn't available to your role.");

    let row;
    try {
      [row] = await tx
        .insert(permissionRequest)
        .values({ officeId: actor.officeId, requesterId: actor.id, permission, justification: input.justification })
        .returning({ id: permissionRequest.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError("CONFLICT", "You've already asked for this. It's waiting for a Developer.");
      throw error;
    }
    await audit({ action: "permission.requested", entityType: "permission_request", entityId: row.id, after: { permission, justification: input.justification } });
    await emit("permission.requested", { requestId: row.id, permission, requesterName: actor.name, officeName: actor.officeName });
    revalidatePath("/access");
    return { id: row.id };
  },
});

export const decideRequest = guard({
  permission: "permission.grant",
  input: z.object({ id: z.uuid(), approve: z.boolean() }),
  run: async ({ input: { id, approve }, tx, actor, audit, emit }) => {
    const [request] = await tx
      .update(permissionRequest)
      .set({ status: approve ? "approved" : "rejected", decidedBy: actor.id, decidedAt: new Date() })
      .where(and(eq(permissionRequest.id, id), eq(permissionRequest.status, "pending")))
      .returning();
    if (!request) throw new AppError("CONFLICT", "This request has already been decided.");

    if (approve) {
      const values = {
        subjectType: "user" as const,
        subjectId: request.requesterId,
        officeId: request.officeId,
        permission: request.permission,
        effect: "allow" as const,
        reason: `Requested: ${request.justification}`,
        expiresAt: null,
        grantedBy: actor.id,
      };
      await tx
        .insert(permissionGrant)
        .values(values)
        .onConflictDoUpdate({
          target: [permissionGrant.subjectType, permissionGrant.subjectId, permissionGrant.permission],
          set: { effect: values.effect, reason: values.reason, expiresAt: null, grantedBy: actor.id },
        });
    }
    await audit({
      action: approve ? "permission.request_approved" : "permission.request_rejected",
      entityType: "permission_request",
      entityId: id,
      officeId: request.officeId,
      after: { permission: request.permission },
    });
    await emit("permission.changed", {
      userIds: [request.requesterId],
      summary: approve ? `Your request for ${request.permission} was approved.` : `Your request for ${request.permission} was declined.`,
    });
    revalidatePath("/console/permissions");
    return { id };
  },
});
