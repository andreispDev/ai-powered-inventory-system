"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appUser, assignment, item, transfer } from "@/server/db/schema";
import { AppError } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";

const officeOf = (actor: { officeId: string | null }) => {
  if (!actor.officeId) throw new AppError("FORBIDDEN", "Inventory changes are made by office accounts.");
  return actor.officeId;
};

const missingTransfer = () => new AppError("NOT_FOUND", "This transfer no longer exists.");

const TRANSFER_ERRORS: Record<string, AppError> = {
  transfer_not_found: missingTransfer(),
  transfer_not_pending: new AppError("CONFLICT", "This transfer has already been answered."),
  transfer_bad_category: new AppError("VALIDATION", "Please check the highlighted fields.", {
    categoryId: ["Choose one of your active categories."],
  }),
  transfer_insufficient_stock: new AppError("CONFLICT", "The sending office no longer has enough stock for this transfer."),
};

const day = z.iso.date("Enter a valid date.");

export const createAssignment = guard({
  permission: "assignment.manage",
  input: z.object({
    itemId: z.uuid(),
    assigneeId: z.uuid("Choose a person."),
    since: day,
    dueAt: z.union([z.literal(""), day]).transform((value) => value || null),
    note: z
      .string()
      .trim()
      .max(300)
      .transform((value) => value || null),
  }),
  run: async ({ input, tx, actor, audit, emit }) => {
    const officeId = officeOf(actor);
    if (input.dueAt && input.dueAt < input.since) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { dueAt: ["The return date can't be before the start date."] });
    }
    const [target] = await tx.select({ id: item.id }).from(item).where(and(eq(item.id, input.itemId), isNull(item.deletedAt)));
    if (!target) throw new AppError("NOT_FOUND", "This item no longer exists.");
    // RLS hides people in other offices, so this also stops assigning across offices.
    const [person] = await tx.select({ name: appUser.name, status: appUser.status }).from(appUser).where(eq(appUser.id, input.assigneeId));
    if (!person || person.status === "deactivated") {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { assigneeId: ["Choose an active person in your office."] });
    }
    const [row] = await tx
      .insert(assignment)
      .values({ ...input, officeId, assignedBy: actor.id })
      .returning({ id: assignment.id });
    await audit({ action: "assignment.created", entityType: "item", entityId: input.itemId, after: { assignee: person.name, since: input.since, dueAt: input.dueAt } });
    await emit("assignment.created", { assignmentId: row.id, assigneeName: person.name, assignedByName: actor.name });
    revalidatePath(`/inventory/${input.itemId}`);
    revalidatePath("/assignments");
    return { id: row.id };
  },
});

export const returnAssignment = guard({
  permission: "assignment.manage",
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, audit }) => {
    const [row] = await tx
      .update(assignment)
      .set({ returnedAt: new Date() })
      .where(and(eq(assignment.id, id), isNull(assignment.returnedAt)))
      .returning({ itemId: assignment.itemId });
    if (!row) throw new AppError("CONFLICT", "This has already been returned.");
    await audit({ action: "assignment.returned", entityType: "item", entityId: row.itemId });
    revalidatePath(`/inventory/${row.itemId}`);
    revalidatePath("/assignments");
    return { id };
  },
});

export const createTransfer = guard({
  permission: "transfer.create",
  input: z.object({
    itemId: z.uuid(),
    toOfficeId: z.uuid("Choose an office."),
    quantity: z.coerce.number().int("Enter a whole number.").min(1, "Enter at least 1."),
    note: z
      .string()
      .trim()
      .max(300)
      .transform((value) => value || null),
  }),
  run: async ({ input, tx, actor, audit, emit }) => {
    const officeId = officeOf(actor);
    const [source] = await tx.select().from(item).where(and(eq(item.id, input.itemId), isNull(item.deletedAt)));
    if (!source) throw new AppError("NOT_FOUND", "This item no longer exists.");
    if (input.quantity > source.quantity) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { quantity: [`Only ${source.quantity} ${source.unit} in stock.`] });
    }
    const { rows: offices } = (await tx.execute(sql`select id, name from office_directory()`)) as unknown as { rows: { id: string; name: string }[] };
    const from = offices.find((o) => o.id === officeId);
    const to = offices.find((o) => o.id === input.toOfficeId);
    if (!from || !to || from.id === to.id) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { toOfficeId: ["Choose another active office."] });
    }
    const [row] = await tx
      .insert(transfer)
      .values({
        fromOfficeId: officeId,
        toOfficeId: to.id,
        fromOfficeName: from.name,
        toOfficeName: to.name,
        itemId: source.id,
        itemName: source.name,
        itemSku: source.sku,
        unit: source.unit,
        quantity: input.quantity,
        note: input.note,
        requestedBy: actor.id,
        requestedByName: actor.name,
      })
      .returning({ id: transfer.id });
    await audit({ action: "transfer.requested", entityType: "transfer", entityId: row.id, after: { item: source.name, quantity: input.quantity, to: to.name } });
    await emit("transfer.requested", { transferId: row.id });
    revalidatePath("/transfers");
    return { id: row.id };
  },
});

export const acceptTransfer = guard({
  permission: "transfer.respond",
  input: z.object({ id: z.uuid(), categoryId: z.uuid("Choose a category.") }),
  run: async ({ input: { id, categoryId }, tx, actor, emit }) => {
    officeOf(actor);
    let destId: string | undefined;
    try {
      const { rows } = (await tx.execute(
        sql`select complete_transfer(${id}::uuid, ${categoryId}::uuid, ${actor.id}::uuid, ${actor.name}) as dest`,
      )) as unknown as { rows: { dest: string }[] };
      destId = rows[0]?.dest;
    } catch (error) {
      const cause = (error as { cause?: Error }).cause?.message ?? (error as Error).message;
      const known = Object.keys(TRANSFER_ERRORS).find((key) => cause.includes(key));
      if (known) throw TRANSFER_ERRORS[known];
      throw error;
    }
    await emit("activity", { action: "transfer.completed", entityType: "transfer", entityId: id, actorName: actor.name, at: new Date().toISOString() });
    await emit("transfer.completed", { transferId: id });
    revalidatePath("/transfers");
    revalidatePath(`/transfers/${id}`);
    revalidatePath("/inventory");
    return { id, destId };
  },
});

export const rejectTransfer = guard({
  permission: "transfer.respond",
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, actor, audit, emit }) => {
    const officeId = officeOf(actor);
    const [row] = await tx
      .update(transfer)
      .set({ status: "rejected", respondedByName: actor.name, respondedAt: new Date() })
      .where(and(eq(transfer.id, id), eq(transfer.toOfficeId, officeId), eq(transfer.status, "pending")))
      .returning({ id: transfer.id });
    if (!row) throw new AppError("CONFLICT", "This transfer has already been answered.");
    await audit({ action: "transfer.rejected", entityType: "transfer", entityId: id });
    await emit("transfer.rejected", { transferId: id });
    revalidatePath("/transfers");
    revalidatePath(`/transfers/${id}`);
    return { id };
  },
});

export const cancelTransfer = guard({
  permission: "transfer.create",
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, actor, audit, emit }) => {
    const officeId = officeOf(actor);
    const [row] = await tx
      .update(transfer)
      .set({ status: "cancelled", respondedByName: actor.name, respondedAt: new Date() })
      .where(and(eq(transfer.id, id), eq(transfer.fromOfficeId, officeId), eq(transfer.status, "pending")))
      .returning({ id: transfer.id });
    if (!row) throw new AppError("CONFLICT", "This transfer has already been answered.");
    await audit({ action: "transfer.cancelled", entityType: "transfer", entityId: id });
    await emit("transfer.cancelled", { transferId: id });
    revalidatePath("/transfers");
    revalidatePath(`/transfers/${id}`);
    return { id };
  },
});
