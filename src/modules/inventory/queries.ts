import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { isNumeric, type FieldDef } from "@/modules/categories/field-schema";
import { appUser, category, item, itemAttachment, office, stockMovement } from "@/server/db/schema";
import { itemIsKind, type CategoryKind } from "./kinds";
import type { ScopedTx } from "@/server/db/scope";

export const SORTABLE = {
  name: item.name,
  sku: item.sku,
  quantity: item.quantity,
  status: item.status,
  location: item.location,
  updatedAt: item.updatedAt,
} as const;

export type ItemFilters = {
  /** Inventory lists only stock, and the Records page only records */
  kind?: CategoryKind;
  q?: string;
  categoryId?: string;
  status?: string;
  deleted?: boolean;
  sort?: string;
  direction?: "asc" | "desc";
  /** Custom column filters, from columns the category actually has */
  attributes?: Record<string, string>;
  fields?: readonly FieldDef[];
  offset: number;
  limit: number;
};

const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

export async function listItems(tx: ScopedTx, filters: ItemFilters) {
  const conditions: (SQL | undefined)[] = [filters.deleted ? isNotNull(item.deletedAt) : isNull(item.deletedAt), itemIsKind(filters.kind ?? "stock")];
  const fields = filters.fields ?? [];

  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    conditions.push(
      or(
        sql`${item.searchTsv} @@ websearch_to_tsquery('simple', ${filters.q})`,
        ilike(item.name, like),
        ilike(item.sku, like),
        ilike(item.serialNumber, like),
      ),
    );
  }
  if (filters.categoryId) conditions.push(eq(item.categoryId, filters.categoryId));
  if (filters.status) conditions.push(sql`${item.status}::text = ${filters.status}`);

  for (const [key, value] of Object.entries(filters.attributes ?? {})) {
    const field = fields.find((f) => f.key === key);
    if (!field) continue;
    // Keys come from definitions and values are bound, so user text never becomes SQL.
    const typed = field.type === "boolean" ? value === "true" : field.type === "multi_select" ? [value] : value;
    conditions.push(sql`${item.attributes} @> ${JSON.stringify({ [key]: typed })}::jsonb`);
  }

  const where = and(...conditions);
  const sortKey = filters.sort;
  const direction = filters.direction === "desc" ? desc : asc;
  let orderBy: SQL = direction(item.name);
  if (sortKey && sortKey in SORTABLE) {
    orderBy = direction(SORTABLE[sortKey as keyof typeof SORTABLE]);
  } else if (sortKey?.startsWith("attr:")) {
    const field = fields.find((f) => f.key === sortKey.slice(5));
    if (field) {
      const value = sql`${item.attributes} ->> ${field.key}`;
      orderBy = direction(isNumeric(field.type) ? sql`(${value})::numeric` : value);
    }
  }

  const rows = await tx
      .select({
        id: item.id,
        name: item.name,
        sku: item.sku,
        status: item.status,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        attributes: item.attributes,
        updatedAt: item.updatedAt,
        categoryName: category.name,
        officeName: office.name,
      })
      .from(item)
      .innerJoin(category, eq(item.categoryId, category.id))
      .innerJoin(office, eq(item.officeId, office.id))
      .where(where)
      .orderBy(orderBy, asc(item.id))
      .limit(filters.limit)
      .offset(filters.offset);
  const [{ total }] = await tx.select({ total: count() }).from(item).where(where);
  return { rows, total };
}

export async function getItem(tx: ScopedTx, id: string) {
  const [row] = await tx
    .select({ item, categoryName: category.name, kind: category.kind, disabledFields: category.disabledFields, officeName: office.name })
    .from(item)
    .innerJoin(category, eq(item.categoryId, category.id))
    .innerJoin(office, eq(item.officeId, office.id))
    .where(eq(item.id, id));
  return row;
}

export const listMovements = (tx: ScopedTx, itemId: string, limit: number, offset: number) =>
  tx
    .select({
      id: stockMovement.id,
      type: stockMovement.type,
      delta: stockMovement.delta,
      balanceAfter: stockMovement.balanceAfter,
      reason: stockMovement.reason,
      occurredAt: stockMovement.occurredAt,
      actorId: stockMovement.actorId,
      actorName: appUser.name,
    })
    .from(stockMovement)
    .leftJoin(appUser, eq(stockMovement.actorId, appUser.id))
    .where(eq(stockMovement.itemId, itemId))
    .orderBy(desc(stockMovement.occurredAt), desc(stockMovement.id))
    .limit(limit)
    .offset(offset);

export async function countMovements(tx: ScopedTx, itemId: string) {
  const [{ total }] = await tx.select({ total: count() }).from(stockMovement).where(eq(stockMovement.itemId, itemId));
  return total;
}

/** Names already saved, for suggestions while typing. RLS keeps them to this office. */
export const listItemNames = (tx: ScopedTx, kind: CategoryKind) =>
  tx
    .select({ id: item.id, name: item.name })
    .from(item)
    .where(and(isNull(item.deletedAt), itemIsKind(kind)))
    .orderBy(asc(item.name))
    .limit(1000);

export const listAttachments = (tx: ScopedTx, itemId: string) =>
  tx
    .select({
      id: itemAttachment.id,
      fileName: itemAttachment.fileName,
      sizeBytes: itemAttachment.sizeBytes,
      createdAt: itemAttachment.createdAt,
      uploadedByName: appUser.name,
    })
    .from(itemAttachment)
    .leftJoin(appUser, eq(itemAttachment.uploadedBy, appUser.id))
    .where(eq(itemAttachment.itemId, itemId))
    .orderBy(desc(itemAttachment.createdAt));

export const listPeople = (tx: ScopedTx) =>
  tx
    .select({ id: appUser.id, name: appUser.name })
    .from(appUser)
    .where(and(isNotNull(appUser.officeId), sql`${appUser.status} <> 'deactivated'`))
    .orderBy(asc(appUser.name))
    .limit(500);

export async function inventoryStats(tx: ScopedTx) {
  const [row] = await tx
    .select({
      items: count(),
      units: sql<number>`coalesce(sum(${item.quantity}), 0)::int`,
      outOfStock: sql<number>`(count(*) filter (where ${item.quantity} = 0))::int`,
      value: sql<string>`coalesce(sum(${item.quantity} * ${item.unitCost}), 0)::text`,
    })
    .from(item)
    .where(and(isNull(item.deletedAt), itemIsKind("stock")));
  return row;
}

export const listOutOfStock = (tx: ScopedTx) =>
  tx
    .select({ id: item.id, name: item.name, unit: item.unit })
    .from(item)
    .where(and(isNull(item.deletedAt), eq(item.quantity, 0), itemIsKind("stock")))
    .orderBy(asc(item.name))
    .limit(5);

/** Figures for the dashboard charts. RLS limits them to what this person may see. */
export async function inventoryBreakdown(tx: ScopedTx) {
  const active = and(isNull(item.deletedAt), itemIsKind("stock"));
  const byStatus = await tx.select({ label: item.status, value: count() }).from(item).where(active).groupBy(item.status);
  const byCategory = await tx
    .select({ label: category.name, value: count() })
    .from(item)
    .innerJoin(category, eq(item.categoryId, category.id))
    .where(active)
    .groupBy(category.name);
  const byOffice = await tx
    .select({ label: office.name, value: count() })
    .from(item)
    .innerJoin(office, eq(item.officeId, office.id))
    .where(active)
    .groupBy(office.name);
  return { byStatus, byCategory, byOffice };
}
