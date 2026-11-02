"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { officeBranding, userAvatar } from "@/server/db/schema";
import { AppError } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";
import { parseImage } from "./image";

const imageInput = z.object({ base64: z.string().max(800_000) });

const officeOf = (actor: { officeId: string | null }) => {
  if (!actor.officeId) throw new AppError("FORBIDDEN", "Workspace settings belong to an office.");
  return actor.officeId;
};

const parsed = (base64: string) => {
  const image = parseImage(base64);
  if ("error" in image) throw new AppError("VALIDATION", image.error);
  return image;
};

const refresh = () => revalidatePath("/", "layout");

export const setWorkspaceName = guard({
  permission: "workspace.manage",
  input: z.object({
    name: z
      .string()
      .trim()
      .max(40, "Use 40 characters or fewer.")
      .transform((value) => value || null),
  }),
  run: async ({ input: { name }, tx, actor, audit }) => {
    const officeId = officeOf(actor);
    await tx
      .insert(officeBranding)
      .values({ officeId, workspaceName: name })
      .onConflictDoUpdate({ target: officeBranding.officeId, set: { workspaceName: name, updatedAt: new Date() } });
    await audit({ action: "workspace.renamed", entityType: "office", entityId: officeId, after: { name } });
    refresh();
  },
});

export const setWorkspaceLogo = guard({
  permission: "workspace.manage",
  input: imageInput,
  run: async ({ input, tx, actor, audit }) => {
    const officeId = officeOf(actor);
    const { bytes, type } = parsed(input.base64);
    await tx
      .insert(officeBranding)
      .values({ officeId, logo: bytes, logoType: type })
      .onConflictDoUpdate({ target: officeBranding.officeId, set: { logo: bytes, logoType: type, updatedAt: new Date() } });
    await audit({ action: "workspace.logo_changed", entityType: "office", entityId: officeId });
    refresh();
  },
});

export const removeWorkspaceLogo = guard({
  permission: "workspace.manage",
  input: z.object({}),
  run: async ({ tx, actor, audit }) => {
    const officeId = officeOf(actor);
    await tx.update(officeBranding).set({ logo: null, logoType: null, updatedAt: new Date() }).where(eq(officeBranding.officeId, officeId));
    await audit({ action: "workspace.logo_removed", entityType: "office", entityId: officeId });
    refresh();
  },
});

export const setMyPhoto = guard({
  permission: null,
  input: imageInput,
  run: async ({ input, tx, actor, audit }) => {
    const { bytes, type } = parsed(input.base64);
    await tx
      .insert(userAvatar)
      .values({ userId: actor.id, officeId: actor.officeId, image: bytes, imageType: type })
      .onConflictDoUpdate({ target: userAvatar.userId, set: { image: bytes, imageType: type, updatedAt: new Date() } });
    await audit({ action: "user.photo_changed", entityType: "app_user", entityId: actor.id });
    refresh();
  },
});

export const removeMyPhoto = guard({
  permission: null,
  input: z.object({}),
  run: async ({ tx, actor, audit }) => {
    await tx.delete(userAvatar).where(eq(userAvatar.userId, actor.id));
    await audit({ action: "user.photo_removed", entityType: "app_user", entityId: actor.id });
    refresh();
  },
});
