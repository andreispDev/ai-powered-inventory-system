// The nightly forecast job. No Redis here, so tests can run it directly.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { forecastItem, keepsTheNumbers, type ForecastResult } from "../modules/forecast/engine";
import type { LlmClient } from "../server/ai/ollama";
import { forecast, item, office, stockMovement } from "../server/db/schema";
import type { ScopedTx } from "../server/db/scope";
import { activeInOffices, notify } from "./events";

export type ForecastDraft = { itemId: string; officeId: string; name: string; quantity: number; unit: string; result: ForecastResult };

const ALERT_DAYS = 14;
const EXPLAIN_LIMIT = 20;
const USED = sql`${stockMovement.type} in ('issue', 'transfer_out')`;

/** Computes every office's forecasts. Nothing is saved, so slow AI work can happen outside a transaction. */
export async function draftForecasts(tx: ScopedTx, now = new Date()): Promise<ForecastDraft[]> {
  const items = await tx
    .select({ id: item.id, officeId: item.officeId, name: item.name, quantity: item.quantity, unit: item.unit })
    .from(item)
    .innerJoin(office, eq(item.officeId, office.id))
    .where(and(isNull(item.deletedAt), eq(office.status, "active")));

  const totals = await tx
    .select({
      itemId: stockMovement.itemId,
      first: sql<string>`min(${stockMovement.occurredAt})`,
      uses: sql<number>`count(*) filter (where ${USED})::int`,
    })
    .from(stockMovement)
    .groupBy(stockMovement.itemId);

  // Stock that comes back wasn't really used, so returns cancel out issues.
  const week = sql<string>`to_char(date_trunc('week', ${stockMovement.occurredAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const weeks = await tx
    .select({ itemId: stockMovement.itemId, week, used: sql<number>`sum(-${stockMovement.delta})::int` })
    .from(stockMovement)
    .where(inArray(stockMovement.type, ["issue", "transfer_out", "return"]))
    .groupBy(stockMovement.itemId, week);

  const totalsById = new Map(totals.map((row) => [row.itemId, row]));
  const demandById = new Map<string, Record<string, number>>();
  for (const row of weeks) {
    demandById.set(row.itemId, { ...demandById.get(row.itemId), [row.week]: row.used });
  }

  return items.map((row) => {
    const total = totalsById.get(row.id);
    return {
      itemId: row.id,
      officeId: row.officeId,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      result: forecastItem(
        {
          quantity: row.quantity,
          unit: row.unit,
          firstMovementAt: total ? new Date(total.first) : null,
          demandMovements: total?.uses ?? 0,
          demandByWeek: demandById.get(row.id) ?? {},
        },
        now,
      ),
    };
  });
}

/**
 * Lets the AI reword the soonest stock-outs. It gets the sentence with the computed numbers only,
 * never item text, so nothing stored in a field can instruct it. If it is off, the plain wording stays.
 */
export async function explainForecasts(drafts: ForecastDraft[], llm: LlmClient) {
  const soonest = drafts
    .filter((draft) => draft.result.stockoutAt)
    .sort((a, b) => a.result.stockoutAt!.localeCompare(b.result.stockoutAt!))
    .slice(0, EXPLAIN_LIMIT);
  for (const { result, unit } of soonest) {
    const note = unit ? result.reason.split(unit).join("units") : result.reason;
    try {
      const rewrite = await llm.generate(
        `Rewrite this inventory note as one short, friendly sentence for office staff. Keep every number and date exactly as written. Add no new facts. Reply with the sentence only.\n\nNote: ${note}`,
      );
      if (keepsTheNumbers(note, rewrite)) result.reason = rewrite;
    } catch (error) {
      console.error("Forecast explanations stopped:", String(error));
      return;
    }
  }
}

/** Saves forecasts and warns admins of likely stock-outs. Returns who got a new notification. */
export async function saveForecasts(tx: ScopedTx, drafts: ForecastDraft[], now = new Date()): Promise<string[]> {
  const notified: string[] = [];
  const alertBefore = new Date(now.getTime() + ALERT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  for (const { itemId, officeId, name, quantity, result } of drafts) {
    const values = { ...result, generatedAt: now };
    await tx
      .insert(forecast)
      .values({ itemId, officeId, ...values })
      .onConflictDoUpdate({ target: forecast.itemId, set: values });

    const atRisk = result.stockoutAt && result.stockoutAt <= alertBefore && quantity > 0 && result.confidence !== "low";
    if (atRisk) {
      notified.push(
        ...(await notify(tx, await activeInOffices(tx, [officeId], "admin"), {
          kind: "forecast",
          title: `${name} may run out soon`,
          body: result.reason,
          link: `/inventory/${itemId}`,
          // Dates shift a little each night, so this warns once a month rather than nightly.
          dedupeKey: `forecast:${itemId}:${month}`,
        })),
      );
    }
  }
  return notified;
}
