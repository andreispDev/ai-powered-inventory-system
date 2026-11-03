import "server-only";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { category, categoryField, item, office } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";
import type { FieldConfig, FieldDef, FieldType } from "./field-schema";

export type CategoryField = FieldDef & { id: string; position: number; retiredAt: Date | null };

export const listCategories = (tx: ScopedTx) =>
  tx
    .select({
      id: category.id,
      name: category.name,
      kind: category.kind,
      isFolder: category.isFolder,
      description: category.description,
      parentId: category.parentId,
      archivedAt: category.archivedAt,
      officeName: office.name,
      items: sql<number>`(select count(*)::int from ${item} where ${item.categoryId} = ${category.id} and ${item.deletedAt} is null)`,
      fields: sql<number>`(select count(*)::int from ${categoryField} where ${categoryField.categoryId} = ${category.id} and ${categoryField.retiredAt} is null)`,
    })
    .from(category)
    .innerJoin(office, eq(category.officeId, office.id))
    .orderBy(asc(office.name), asc(category.name));

export async function getCategory(tx: ScopedTx, id: string) {
  const [row] = await tx.select().from(category).where(eq(category.id, id));
  return row;
}

export async function listFields(tx: ScopedTx, categoryId: string, includeRetired = false): Promise<CategoryField[]> {
  const rows = await tx
    .select()
    .from(categoryField)
    .where(
      includeRetired
        ? eq(categoryField.categoryId, categoryId)
        : and(eq(categoryField.categoryId, categoryId), isNull(categoryField.retiredAt)),
    )
    .orderBy(asc(categoryField.position));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type as FieldType,
    config: row.config as FieldConfig,
    position: row.position,
    retiredAt: row.retiredAt,
  }));
}

export async function countCategories(tx: ScopedTx) {
  const [row] = await tx.select({ total: count() }).from(category).where(isNull(category.archivedAt));
  return row.total;
}
