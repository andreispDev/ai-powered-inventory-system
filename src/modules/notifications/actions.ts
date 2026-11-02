"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { announcement, notification } from "@/server/db/schema";
import { AppError } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";

export const markRead = guard({
  permission: null,
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx }) => {
    await tx.update(notification).set({ readAt: new Date() }).where(and(eq(notification.id, id), isNull(notification.readAt)));
  },
});

export const markAllRead = guard({
  permission: null,
  input: z.object({}),
  run: async ({ tx }) => {
    await tx.update(notification).set({ readAt: new Date() }).where(isNull(notification.readAt));
    revalidatePath("/notifications");
  },
});

export const acknowledge = guard({
  permission: null,
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, audit }) => {
    const now = new Date();
    await tx.update(notification).set({ ackedAt: now, readAt: now }).where(eq(notification.id, id));
    await audit({ action: "notification.acknowledged", entityType: "notification", entityId: id });
  },
});

export const createAnnouncement = guard({
  permission: null,
  rateLimit: "bulk",
  input: z.object({
    title: z.string().trim().min(3, "Enter a short title.").max(120),
    body: z.string().trim().min(3, "Enter the message.").max(2000),
    urgent: z.boolean(),
    audienceType: z.enum(["all", "offices", "role"]),
    audienceOfficeIds: z.array(z.uuid()).optional(),
    audienceRole: z.enum(["developer", "admin", "user"]).optional(),
    scheduledAt: z
      .union([z.literal(""), z.iso.datetime({ offset: true })])
      .transform((value) => (value ? new Date(value) : null))
      .optional(),
  }),
  run: async ({ input, tx, actor, audit, emit }) => {
    const global = actor.permissions.includes("announce.all");
    if (!global && !actor.permissions.includes("announce.office")) {
      throw new AppError("FORBIDDEN", "You don't have permission to do this.");
    }
    // Office admins always send to their own office, whatever the form says.
    const audience = global
      ? {
          audienceType: input.audienceType,
          audienceOfficeIds: input.audienceType === "offices" ? input.audienceOfficeIds : null,
          audienceRole: input.audienceType === "role" ? input.audienceRole : null,
        }
      : { audienceType: "offices", audienceOfficeIds: [actor.officeId as string], audienceRole: null };

    if (audience.audienceType === "offices" && !audience.audienceOfficeIds?.length) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { audienceOfficeIds: ["Choose at least one office."] });
    }
    if (audience.audienceType === "role" && !audience.audienceRole) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { audienceRole: ["Choose a role."] });
    }
    if (input.scheduledAt && input.scheduledAt.getTime() < Date.now() - 60_000) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { scheduledAt: ["Choose a time in the future."] });
    }

    const [row] = await tx
      .insert(announcement)
      .values({
        officeId: actor.officeId,
        title: input.title,
        body: input.body,
        urgent: input.urgent,
        scheduledAt: input.scheduledAt ?? null,
        createdBy: actor.id,
        ...audience,
      })
      .returning({ id: announcement.id });
    await audit({ action: "announcement.created", entityType: "announcement", entityId: row.id, after: { title: input.title, ...audience } });
    await emit("announcement.created", { announcementId: row.id });
    revalidatePath("/announcements");
    return { id: row.id };
  },
});

