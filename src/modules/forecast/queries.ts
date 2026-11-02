import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { forecast, item, office } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";

const visible = and(eq(forecast.itemId, item.id), isNull(item.deletedAt));

/** Soonest stock-outs first, then items without a date. RLS limits rows to what this person may see. */
export async function listForecasts(tx: ScopedTx, limit: number, offset: number) {
  const rows = await tx
    .select({ forecast, itemName: item.name, unit: item.unit, quantity: item.quantity, officeName: office.name })
    .from(forecast)
    .innerJoin(item, visible)
    .innerJoin(office, eq(forecast.officeId, office.id))
    .orderBy(sql`${forecast.stockoutAt} asc nulls last`, sql`(${forecast.state} = 'ready') desc`, asc(item.name))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await tx.select({ total: count() }).from(forecast).innerJoin(item, visible);
  return { rows, total };
}

export async function forecastSummary(tx: ScopedTx, now = new Date()) {
  const within30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const [summary] = await tx
    .select({
      soon: sql<number>`count(*) filter (where ${forecast.stockoutAt} <= ${within30})::int`,
      reorder: sql<number>`count(*) filter (where ${forecast.reorderQuantity} is not null)::int`,
      noHistory: sql<number>`count(*) filter (where ${forecast.state} = 'not_enough_history')::int`,
      slow: sql<number>`count(*) filter (where ${forecast.state} = 'slow')::int`,
      updatedAt: sql<string | null>`max(${forecast.generatedAt})`,
    })
    .from(forecast)
    .innerJoin(item, visible);
  return { ...summary, updatedAt: summary.updatedAt ? new Date(summary.updatedAt) : null };
}

/** How forecasts compare with the simple baseline, per office. Lower error is better. */
export const forecastAccuracy = (tx: ScopedTx) =>
  tx
    .select({
      officeName: office.name,
      items: count(),
      error: sql<number>`round(avg(${forecast.backtestError})::numeric, 2)::float`,
      baseline: sql<number>`round(avg(${forecast.baselineError})::numeric, 2)::float`,
    })
    .from(forecast)
    .innerJoin(item, visible)
    .innerJoin(office, eq(forecast.officeId, office.id))
    .where(eq(forecast.state, "ready"))
    .groupBy(office.name)
    .orderBy(asc(office.name));

export const getItemForecast = async (tx: ScopedTx, itemId: string) => {
  const [row] = await tx.select().from(forecast).where(eq(forecast.itemId, itemId));
  return row ?? null;
};

/** Stock-outs for the dashboard, soonest first. */
export const listSoonestStockouts = (tx: ScopedTx) =>
  tx
    .select({ itemId: forecast.itemId, name: item.name, stockoutAt: forecast.stockoutAt, confidence: forecast.confidence })
    .from(forecast)
    .innerJoin(item, visible)
    .where(sql`${forecast.stockoutAt} is not null and ${item.quantity} > 0`)
    .orderBy(asc(forecast.stockoutAt))
    .limit(5);
