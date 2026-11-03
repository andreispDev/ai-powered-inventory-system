"use server";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { category, categoryField, item } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";
import { AppError, isUniqueViolation } from "@/server/guard/errors";
import { guard } from "@/server/guard/guard";
import {
  FIELD_TYPES,
  fieldChangeProblem,
  fieldConfigSchema,
  isChoice,
  keyFromLabel,
  MAX_FIELDS_PER_CATEGORY,
  OPTIONAL_ITEM_FIELDS,
  type OptionalItemField,
  type FieldConfig,
  type FieldDef,
  type FieldType,
} from "./field-schema";

const MAX_DEPTH = 3;
const nameTaken = () =>
  new AppError("VALIDATION", "Please check the highlighted fields.", { name: ["This name is already used here."] });
const missing = () => new AppError("NOT_FOUND", "This category no longer exists.");

function officeOf(actor: { officeId: string | null }) {
  if (!actor.officeId) throw new AppError("FORBIDDEN", "Inventory changes are made by office accounts.");
  return actor.officeId;
}

async function depthOf(tx: ScopedTx, id: string): Promise<number> {
  let depth = 0;
  let current: string | null = id;
  while (current && depth <= MAX_DEPTH) {
    const [row]: { parentId: string | null }[] = await tx
      .select({ parentId: category.parentId })
      .from(category)
      .where(eq(category.id, current));
    if (!row) throw missing();
    depth += 1;
    current = row.parentId;
  }
  return depth;
}

const categoryInput = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(80),
  description: z
    .string()
    .trim()
    .max(300)
    .transform((value) => value || null)
    .optional(),
});

const newColumn = z.object({
  label: z.string().trim().min(1, "Enter a column name.").max(60),
  type: z.enum(FIELD_TYPES.map((t) => t.id) as [FieldType, ...FieldType[]]),
  config: fieldConfigSchema,
});

export const createCategory = guard({
  permission: "category.create",
  input: categoryInput.extend({
    parentId: z.uuid().optional(),
    kind: z.enum(["stock", "records"]).default("stock"),
    /** Ignored at the top level, which is always a folder */
    isFolder: z.boolean().default(false),
    columns: z.array(newColumn).max(MAX_FIELDS_PER_CATEGORY).default([]),
    disabledFields: z.array(z.enum(OPTIONAL_ITEM_FIELDS.map((f) => f.id) as [OptionalItemField, ...OptionalItemField[]])).default([]),
  }),
  run: async ({ input: { columns: requested, ...input }, tx, actor, audit }) => {
    const officeId = officeOf(actor);
    const depth = input.parentId ? (await depthOf(tx, input.parentId)) + 1 : 1;
    if (depth > MAX_DEPTH) {
      throw new AppError("VALIDATION", "Categories can be nested up to 3 levels.", {
        parentId: ["This is already at the deepest level."],
      });
    }
    if (input.parentId) {
      const [parent] = await tx.select({ kind: category.kind, isFolder: category.isFolder }).from(category).where(eq(category.id, input.parentId));
      if (!parent) throw missing();
      // A category sits only inside its own kind, so one tree never mixes stock and records.
      if (parent.kind !== input.kind) {
        throw new AppError("VALIDATION", "Please check the highlighted fields.", { parentId: ["That category is a different type."] });
      }
      if (!parent.isFolder) throw new AppError("CONFLICT", "Subcategories go inside folders. This one is a table.");
    }
    // The top is always a folder, and the deepest level is always a table.
    input.isFolder = depth === 1 || (input.isFolder && depth < MAX_DEPTH);
    const columns = input.isFolder ? [] : requested;
    if (input.isFolder) input.disabledFields = [];
    let row;
    try {
      [row] = await tx.insert(category).values({ ...input, officeId }).returning({ id: category.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    // In the same transaction, so a bad column leaves no half-made category behind.
    const taken: string[] = [];
    for (const [index, column] of columns.entries()) {
      checkChoiceOptions(column.type, column.config);
      const key = keyFromLabel(column.label, taken);
      taken.push(key);
      await tx.insert(categoryField).values({ officeId, categoryId: row.id, key, label: column.label, type: column.type, config: column.config, position: index + 1 });
    }
    await audit({ action: "category.created", entityType: "category", entityId: row.id, after: { ...input, columns } });
    revalidatePath("/categories");
    return { id: row.id };
  },
});

export const updateCategory = guard({
  permission: "category.update",
  input: categoryInput.extend({ id: z.uuid() }),
  run: async ({ input: { id, ...changes }, tx, audit }) => {
    const [before] = await tx.select().from(category).where(eq(category.id, id));
    if (!before) throw missing();
    try {
      await tx.update(category).set(changes).where(eq(category.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    await audit({ action: "category.updated", entityType: "category", entityId: id, before, after: changes });
    revalidatePath(`/categories/${id}`);
    return { id };
  },
});

/** Categories are archived rather than deleted, so items and history stay intact. */
export const setCategoryArchived = guard({
  permission: "category.archive",
  input: z.object({ id: z.uuid(), archived: z.boolean() }),
  run: async ({ input: { id, archived }, tx, audit }) => {
    const [row] = await tx
      .update(category)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(category.id, id))
      .returning({ id: category.id });
    if (!row) throw missing();
    await audit({ action: archived ? "category.archived" : "category.restored", entityType: "category", entityId: id });
    revalidatePath("/categories");
    revalidatePath(`/categories/${id}`);
    return { id };
  },
});

const fieldInput = z.object({
  label: z.string().trim().min(1, "Enter a column name.").max(60),
  config: fieldConfigSchema,
});

function checkChoiceOptions(type: FieldType, config: FieldConfig) {
  if (isChoice(type) && !config.options?.length) {
    throw new AppError("VALIDATION", "Please check the highlighted fields.", {
      options: ["Add at least one choice."],
    });
  }
}

export const addField = guard({
  permission: "category.update",
  input: fieldInput.extend({
    categoryId: z.uuid(),
    type: z.enum(FIELD_TYPES.map((t) => t.id) as [FieldType, ...FieldType[]]),
  }),
  run: async ({ input, tx, actor, audit }) => {
    const officeId = officeOf(actor);
    checkChoiceOptions(input.type, input.config);
    const [parent] = await tx.select({ id: category.id, isFolder: category.isFolder }).from(category).where(eq(category.id, input.categoryId)).for("update");
    if (!parent) throw missing();
    if (parent.isFolder) throw new AppError("CONFLICT", "A folder has no columns. Add them to a table inside it.");

    const existing = await tx
      .select({ key: categoryField.key, position: categoryField.position, retiredAt: categoryField.retiredAt })
      .from(categoryField)
      .where(eq(categoryField.categoryId, input.categoryId));
    if (existing.filter((f) => !f.retiredAt).length >= MAX_FIELDS_PER_CATEGORY) {
      throw new AppError("CONFLICT", `A category can have up to ${MAX_FIELDS_PER_CATEGORY} columns.`);
    }
    const key = keyFromLabel(input.label, existing.map((f) => f.key));
    const position = Math.max(0, ...existing.map((f) => f.position)) + 1;
    const [row] = await tx
      .insert(categoryField)
      .values({ officeId, categoryId: input.categoryId, key, label: input.label, type: input.type, config: input.config, position })
      .returning({ id: categoryField.id });
    await audit({ action: "category_field.created", entityType: "category_field", entityId: row.id, after: { ...input, key } });
    revalidatePath(`/categories/${input.categoryId}`);
    return { id: row.id };
  },
});

export const updateField = guard({
  permission: "category.update",
  input: fieldInput.extend({ id: z.uuid() }),
  run: async ({ input: { id, label, config }, tx, audit }) => {
    const [before] = await tx.select().from(categoryField).where(eq(categoryField.id, id));
    if (!before) throw new AppError("NOT_FOUND", "This column no longer exists.");
    checkChoiceOptions(before.type as FieldType, config);

    const rows = await tx
      .select({ value: sql<unknown>`${item.attributes} -> ${before.key}` })
      .from(item)
      .where(and(eq(item.categoryId, before.categoryId), sql`${item.attributes} ? ${before.key}`, isNull(item.deletedAt)));
    if (config.required && !before.config.required) {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(item)
        .where(and(eq(item.categoryId, before.categoryId), isNull(item.deletedAt)));
      if (total > rows.length) {
        throw new AppError("CONFLICT", "Some items have no value for this column. Fill those in before making it required.");
      }
    }
    const problem = fieldChangeProblem(before as unknown as FieldDef, config, rows.map((r) => r.value));
    if (problem) throw new AppError("CONFLICT", problem);

    await tx.update(categoryField).set({ label, config }).where(eq(categoryField.id, id));
    await audit({ action: "category_field.updated", entityType: "category_field", entityId: id, before, after: { label, config } });
    revalidatePath(`/categories/${before.categoryId}`);
    return { id };
  },
});

/** Retiring hides a column but keeps its values, so it can be brought back. */
export const setFieldRetired = guard({
  permission: "category.update",
  input: z.object({ id: z.uuid(), retired: z.boolean() }),
  run: async ({ input: { id, retired }, tx, audit }) => {
    const [row] = await tx
      .update(categoryField)
      .set({ retiredAt: retired ? new Date() : null })
      .where(eq(categoryField.id, id))
      .returning({ categoryId: categoryField.categoryId });
    if (!row) throw new AppError("NOT_FOUND", "This column no longer exists.");
    await audit({ action: retired ? "category_field.retired" : "category_field.restored", entityType: "category_field", entityId: id });
    revalidatePath(`/categories/${row.categoryId}`);
    return { id };
  },
});

export const moveField = guard({
  permission: "category.update",
  input: z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }),
  run: async ({ input: { id, direction }, tx, audit }) => {
    const [target] = await tx.select().from(categoryField).where(eq(categoryField.id, id));
    if (!target) throw new AppError("NOT_FOUND", "This column no longer exists.");
    const fields = await tx
      .select({ id: categoryField.id, position: categoryField.position })
      .from(categoryField)
      .where(and(eq(categoryField.categoryId, target.categoryId), isNull(categoryField.retiredAt)))
      .orderBy(asc(categoryField.position));
    const index = fields.findIndex((f) => f.id === id);
    const other = fields[index + (direction === "up" ? -1 : 1)];
    if (other) {
      await tx.update(categoryField).set({ position: other.position }).where(eq(categoryField.id, id));
      await tx.update(categoryField).set({ position: target.position }).where(eq(categoryField.id, other.id));
      await audit({ action: "category_field.moved", entityType: "category_field", entityId: id, after: { direction } });
    }
    revalidatePath(`/categories/${target.categoryId}`);
    return { id };
  },
});

export const setFieldDisabled = guard({
  permission: "category.update",
  input: z.object({
    id: z.uuid(),
    field: z.enum(OPTIONAL_ITEM_FIELDS.map((f) => f.id) as [OptionalItemField, ...OptionalItemField[]]),
    disabled: z.boolean(),
  }),
  run: async ({ input: { id, field, disabled }, tx, audit }) => {
    const [row] = await tx.select({ disabledFields: category.disabledFields }).from(category).where(eq(category.id, id)).for("update");
    if (!row) throw missing();
    const next = disabled ? [...new Set([...row.disabledFields, field])] : row.disabledFields.filter((name) => name !== field);
    await tx.update(category).set({ disabledFields: next }).where(eq(category.id, id));
    await audit({ action: disabled ? "category.field_disabled" : "category.field_enabled", entityType: "category", entityId: id, after: { field } });
    revalidatePath(`/categories/${id}`);
    return { id };
  },
});

const PURGE_ERRORS: Record<string, AppError> = {
  purge_not_approved: new AppError("FORBIDDEN", "A Developer needs to approve this first. Ask on the Request access page."),
  purge_not_allowed: new AppError("FORBIDDEN", "Inventory changes are made by office accounts."),
};

/** Permanent. Each run uses up the Developer's approval, so the next one needs a new approval. */
export const purgeOfficeData = guard({
  permission: "data.purge",
  input: z.object({ categories: z.boolean(), confirm: z.string() }),
  run: async ({ input, tx, actor, audit }) => {
    officeOf(actor);
    if (input.confirm.trim() !== actor.officeName) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { confirm: [`Type ${actor.officeName} exactly.`] });
    }
    let removed: { items: number; categories: number };
    try {
      const { rows } = (await tx.execute(sql`select purge_office_data(${input.categories}) as removed`)) as unknown as {
        rows: { removed: { items: number; categories: number } }[];
      };
      removed = rows[0].removed;
    } catch (error) {
      const cause = (error as { cause?: Error }).cause?.message ?? (error as Error).message;
      const known = Object.keys(PURGE_ERRORS).find((key) => cause.includes(key));
      if (known) throw PURGE_ERRORS[known];
      throw error;
    }
    await audit({
      action: input.categories ? "data.purged_all" : "data.purged_rows",
      entityType: "office",
      entityId: actor.officeId!,
      after: removed,
    });
    revalidatePath("/categories");
    revalidatePath("/inventory");
    revalidatePath("/records");
    return removed;
  },
});
