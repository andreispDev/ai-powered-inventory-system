"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildAttributesSchema, OPTIONAL_ITEM_FIELDS } from "@/modules/categories/field-schema";
import { listFields } from "@/modules/categories/queries";
import { category, item, stockMovement } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";
import { AppError, isUniqueViolation } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";
import { deltaOf, itemCoreSchema, movementSchema } from "./schemas";

const missing = () => new AppError("NOT_FOUND", "This item no longer exists.");

const OPTIONAL_IDS: readonly string[] = OPTIONAL_ITEM_FIELDS.map((field) => field.id);

/** Fields a category has turned off are ignored, so a stale form can't change them. */
function withoutDisabled<T extends Record<string, unknown>>(core: T, disabled: readonly string[]): T {
  return Object.fromEntries(Object.entries(core).filter(([key]) => !(OPTIONAL_IDS.includes(key) && disabled.includes(key)))) as T;
}
const skuTaken = () =>
  new AppError("VALIDATION", "Please check the highlighted fields.", { sku: ["Another item already uses this SKU."] });

const LABELS: Record<string, string> = {
  name: "Name",
  sku: "SKU",
  status: "Status",
  unit: "Unit",
  location: "Location",
  condition: "Condition",
  serialNumber: "Serial number",
  supplier: "Supplier",
  unitCost: "Unit cost",
  purchaseDate: "Purchase date",
  warrantyExpiry: "Warranty expiry",
  notes: "Notes",
};

/** Checks custom columns against the category's definitions, on the server, every time. */
async function validateAttributes(tx: ScopedTx, categoryId: string, attributes: Record<string, unknown>) {
  const fields = await listFields(tx, categoryId);
  const parsed = buildAttributesSchema(fields).safeParse(attributes);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) fieldErrors[`attr.${String(issue.path[0])}`] = [issue.message];
    throw new AppError("VALIDATION", "Please check the highlighted fields.", fieldErrors);
  }
  return { attributes: parsed.data, activeKeys: new Set(fields.map((f) => f.key)) };
}

/** Records aren't counted, so nothing about stock applies to them. */
async function assertStock(tx: ScopedTx, categoryId: string) {
  const [parent] = await tx.select({ kind: category.kind }).from(category).where(eq(category.id, categoryId));
  if (parent?.kind === "records") throw new AppError("CONFLICT", "This is a record, not a stock item.");
}

export const createItem = guard({
  permission: "item.create",
  input: itemCoreSchema.extend({
    categoryId: z.uuid(),
    quantity: z.coerce.number().int("Enter a whole number.").min(0, "Can't be negative.").max(1_000_000),
  }),
  run: async ({ input: { attributes: rawAttributes, quantity: requested, ...core }, tx, actor, audit }) => {
    if (!actor.officeId) throw new AppError("FORBIDDEN", "Inventory changes are made by office accounts.");
    const [parent] = await tx.select().from(category).where(eq(category.id, core.categoryId));
    if (!parent) throw new AppError("NOT_FOUND", "This category no longer exists.");
    if (parent.archivedAt) throw new AppError("CONFLICT", "This category is archived.");
    const { attributes } = await validateAttributes(tx, core.categoryId, rawAttributes);
    const quantity = parent.kind === "records" ? 0 : requested;

    let row;
    try {
      [row] = await tx
        .insert(item)
        .values({ ...withoutDisabled(core, parent.disabledFields), attributes, quantity, officeId: actor.officeId })
        .returning({ id: item.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw skuTaken();
      throw error;
    }
    if (quantity > 0) {
      await tx.insert(stockMovement).values({
        officeId: actor.officeId,
        itemId: row.id,
        type: "receive",
        delta: quantity,
        balanceAfter: quantity,
        reason: "Initial stock",
        actorId: actor.id,
      });
    }
    await audit({ action: "item.created", entityType: "item", entityId: row.id, after: { ...core, quantity, attributes } });
    revalidatePath("/inventory");
    revalidatePath("/records");
    return { id: row.id };
  },
});

export const updateItem = guard({
  permission: "item.update",
  input: itemCoreSchema.extend({ id: z.uuid(), version: z.number().int() }),
  run: async ({ input: { id, version, attributes: rawAttributes, ...core }, tx, audit }) => {
    const [before] = await tx.select().from(item).where(and(eq(item.id, id), isNull(item.deletedAt)));
    if (!before) throw missing();

    if (before.version !== version) {
      // Saving now would overwrite someone else's edit, so say exactly what they changed.
      const changed = Object.keys(LABELS).filter(
        (key) => String(before[key as keyof typeof before] ?? "") !== String(core[key as keyof typeof core] ?? ""),
      );
      throw new AppError(
        "CONFLICT",
        `Someone else changed this item while you were editing${
          changed.length ? ` (differs: ${changed.map((key) => LABELS[key]).join(", ")})` : ""
        }. Reload to see the latest, then make your change again.`,
      );
    }

    const { attributes, activeKeys } = await validateAttributes(tx, before.categoryId, rawAttributes);
    const [parent] = await tx.select({ disabledFields: category.disabledFields }).from(category).where(eq(category.id, before.categoryId));
    const allowed = withoutDisabled(core, parent?.disabledFields ?? []);
    // Values in retired columns are kept, in case the column comes back.
    const kept = Object.fromEntries(Object.entries(before.attributes).filter(([key]) => !activeKeys.has(key)));
    const merged = { ...kept, ...attributes };

    let updated;
    try {
      [updated] = await tx
        .update(item)
        .set({ ...allowed, attributes: merged, version: sql`${item.version} + 1` })
        .where(and(eq(item.id, id), eq(item.version, version)))
        .returning({ id: item.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw skuTaken();
      throw error;
    }
    if (!updated) throw new AppError("CONFLICT", "Someone else just changed this item. Reload and try again.");

    await audit({ action: "item.updated", entityType: "item", entityId: id, before, after: { ...allowed, attributes: merged } });
    revalidatePath(`/inventory/${id}`);
    revalidatePath("/inventory");
    return { id };
  },
});

/** Quantity changes only here, so the history can always explain the current number. */
export const moveStock = guard({
  permission: "stock.move",
  input: movementSchema,
  run: async ({ input: { itemId, type, amount, reason }, tx, actor, audit }) => {
    if (!actor.officeId) throw new AppError("FORBIDDEN", "Inventory changes are made by office accounts.");
    const [row] = await tx.select().from(item).where(and(eq(item.id, itemId), isNull(item.deletedAt))).for("update");
    if (!row) throw missing();
    await assertStock(tx, row.categoryId);

    const delta = deltaOf(type, amount);
    const balanceAfter = row.quantity + delta;
    if (balanceAfter < 0) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", {
        amount: [`Only ${row.quantity} ${row.unit} in stock.`],
      });
    }
    await tx
      .update(item)
      .set({ quantity: balanceAfter, version: sql`${item.version} + 1` })
      .where(eq(item.id, itemId));
    await tx.insert(stockMovement).values({ officeId: actor.officeId, itemId, type, delta, balanceAfter, reason, actorId: actor.id });
    await audit({
      action: `stock.${type}`,
      entityType: "item",
      entityId: itemId,
      before: { quantity: row.quantity },
      after: { quantity: balanceAfter, reason },
    });
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/inventory");
    return { quantity: balanceAfter };
  },
});

export const deleteItem = guard({
  permission: "item.delete",
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, audit }) => {
    const [row] = await tx
      .update(item)
      .set({ deletedAt: new Date(), version: sql`${item.version} + 1` })
      .where(and(eq(item.id, id), isNull(item.deletedAt)))
      .returning({ id: item.id, name: item.name });
    if (!row) throw missing();
    await audit({ action: "item.deleted", entityType: "item", entityId: id, before: { name: row.name } });
    revalidatePath("/inventory");
    return { id };
  },
});

export const restoreItem = guard({
  permission: "item.restore",
  input: z.object({ id: z.uuid() }),
  run: async ({ input: { id }, tx, audit }) => {
    let row;
    try {
      [row] = await tx
        .update(item)
        .set({ deletedAt: null, version: sql`${item.version} + 1` })
        .where(and(eq(item.id, id), isNotNull(item.deletedAt)))
        .returning({ id: item.id });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Another item now uses this SKU. Change that one first.");
      }
      throw error;
    }
    if (!row) throw missing();
    await audit({ action: "item.restored", entityType: "item", entityId: id });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { id };
  },
});
