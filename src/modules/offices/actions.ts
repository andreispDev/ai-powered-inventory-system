"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { office } from "@/server/db/schema";
import { AppError, isUniqueViolation } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";
import { officeSchema } from "./schemas";

const codeTaken = () =>
  new AppError("VALIDATION", "Please check the highlighted fields.", { code: ["Another office already uses this code."] });

export const createOffice = guard({
  permission: "office.manage",
  input: officeSchema,
  run: async ({ input, tx, audit }) => {
    let row;
    try {
      [row] = await tx.insert(office).values(input).returning();
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
    await audit({ action: "office.created", entityType: "office", entityId: row.id, officeId: row.id, after: input });
    revalidatePath("/console/offices");
    return { id: row.id };
  },
});

export const updateOffice = guard({
  permission: "office.manage",
  input: officeSchema.extend({ id: z.uuid() }),
  run: async ({ input: { id, ...changes }, tx, audit }) => {
    const [before] = await tx.select().from(office).where(eq(office.id, id));
    if (!before) throw new AppError("NOT_FOUND", "This office no longer exists.");
    try {
      await tx.update(office).set(changes).where(eq(office.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
    await audit({ action: "office.updated", entityType: "office", entityId: id, officeId: id, before, after: changes });
    revalidatePath(`/console/offices/${id}`);
    revalidatePath("/console/offices");
    return { id };
  },
});

export const setOfficeArchived = guard({
  permission: "office.manage",
  input: z.object({ id: z.uuid(), archived: z.boolean() }),
  run: async ({ input: { id, archived }, tx, audit }) => {
    const status = archived ? ("archived" as const) : ("active" as const);
    const [row] = await tx.update(office).set({ status }).where(eq(office.id, id)).returning({ id: office.id });
    if (!row) throw new AppError("NOT_FOUND", "This office no longer exists.");
    await audit({ action: `office.${status}`, entityType: "office", entityId: id, officeId: id });
    revalidatePath(`/console/offices/${id}`);
    revalidatePath("/console/offices");
    return { id };
  },
});
