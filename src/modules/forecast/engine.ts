// Stock forecasts. Plain statistics with no database or AI, so they are repeatable and testable.

export type ForecastState = "ready" | "not_enough_history" | "slow";
export type Confidence = "high" | "medium" | "low";

export type ForecastInput = {
  quantity: number;
  unit: string;
  firstMovementAt: Date | null;
  /** How many times stock left the office */
  demandMovements: number;
  /** Units used, by the Monday (YYYY-MM-DD) that starts each week */
  demandByWeek: Record<string, number>;
};

export type ForecastResult = {
  state: ForecastState;
  method: string | null;
  weeklyDemand: number | null;
  weeklyLow: number | null;
  weeklyHigh: number | null;
  stockoutAt: string | null;
  stockoutEarliest: string | null;
  stockoutLatest: string | null;
  reorderQuantity: number | null;
  reorderBy: string | null;
  confidence: Confidence | null;
  backtestError: number | null;
  baselineError: number | null;
  reason: string;
};

/** Predicts the week after a series. A later model can replace these without touching callers. */
export type Forecaster = { name: string; predictNext: (series: number[]) => number };

const MIN_WEEKS = 8;
const MIN_MOVEMENTS = 5;
const QUIET_WEEKS = 8;
const BASELINE_LAG = 4;
const BACKTEST_WEEKS = 12;
const INTERMITTENT_BELOW = 0.75;
// Items don't record a supplier lead time yet, so reorder advice assumes two weeks.
const LEAD_WEEKS = 2;
const COVER_WEEKS = 4;
const SAFETY_FACTOR = 1.65;
const RANGE_FACTOR = 1.28;
const MAX_HORIZON_DAYS = 365;
const REORDER_WITHIN_DAYS = 60;
const DAY = 86_400_000;

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/** Teunter-Syntetos-Babai: for stock used in some weeks and not others. */
export const tsb: Forecaster = {
  name: "tsb",
  predictNext(series) {
    const used = series.filter((value) => value > 0);
    if (used.length === 0) return 0;
    let chance = used.length / series.length;
    let size = mean(used);
    for (const value of series) {
      chance += 0.1 * ((value > 0 ? 1 : 0) - chance);
      if (value > 0) size += 0.1 * (value - size);
    }
    return Math.max(0, chance * size);
  },
};

/** Holt's trend smoothing, damped. Yearly seasons would need two years of history, which offices don't have yet. */
export const holt: Forecaster = {
  name: "holt",
  predictNext(series) {
    if (series.length === 0) return 0;
    let level = series[0];
    let trend = 0;
    for (const value of series.slice(1)) {
      const previous = level;
      level = 0.3 * value + 0.7 * (level + 0.9 * trend);
      trend = 0.1 * (level - previous) + 0.9 * 0.9 * trend;
    }
    return Math.max(0, level + 0.9 * trend);
  },
};

export const startOfWeek = (date: Date) => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Whole weeks only: the current week is still in progress and would look like a drop. */
export function weeklySeries(first: Date, demandByWeek: Record<string, number>, now: Date): number[] {
  const series: number[] = [];
  const end = startOfWeek(now).getTime();
  for (let week = startOfWeek(first).getTime(); week < end; week += 7 * DAY) {
    series.push(Math.max(0, demandByWeek[isoDay(new Date(week))] ?? 0));
  }
  return series;
}

/** Replays recent weeks, predicting each from only what came before it. */
export function backtest(series: number[], forecaster: Forecaster) {
  const start = Math.max(BASELINE_LAG, series.length - BACKTEST_WEEKS);
  const errors: number[] = [];
  const baselineErrors: number[] = [];
  for (let week = start; week < series.length; week++) {
    errors.push(Math.abs(forecaster.predictNext(series.slice(0, week)) - series[week]));
    baselineErrors.push(Math.abs(series[week - BASELINE_LAG] - series[week]));
  }
  return {
    error: mean(errors),
    baselineError: mean(baselineErrors),
    rmse: Math.sqrt(mean(errors.map((error) => error * error))),
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const after = (now: Date, days: number) => new Date(now.getTime() + days * DAY);

export const formatForecastDay = (day: string) =>
  new Date(day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const empty = (state: ForecastState, reason: string): ForecastResult => ({
  state,
  method: null,
  weeklyDemand: null,
  weeklyLow: null,
  weeklyHigh: null,
  stockoutAt: null,
  stockoutEarliest: null,
  stockoutLatest: null,
  reorderQuantity: null,
  reorderBy: null,
  confidence: null,
  backtestError: null,
  baselineError: null,
  reason,
});

/** The day stock runs out at this rate, or null if that is over a year away. */
function runOutDay(quantity: number, weekly: number, now: Date) {
  if (weekly <= 0) return null;
  const days = Math.floor((quantity / weekly) * 7);
  return days > MAX_HORIZON_DAYS ? null : isoDay(after(now, days));
}

export function forecastItem(input: ForecastInput, now: Date): ForecastResult {
  const series = input.firstMovementAt ? weeklySeries(input.firstMovementAt, input.demandByWeek, now) : [];
  const unit = input.unit;

  if (series.length >= QUIET_WEEKS && series.slice(-QUIET_WEEKS).every((value) => value === 0)) {
    return empty("slow", `None used in the last ${QUIET_WEEKS} weeks, and ${input.quantity} ${unit} are on hand.`);
  }
  if (series.length < MIN_WEEKS || input.demandMovements < MIN_MOVEMENTS) {
    return empty("not_enough_history", `Not enough history yet. Forecasts start after ${MIN_WEEKS} weeks and ${MIN_MOVEMENTS} uses.`);
  }

  const usedShare = series.filter((value) => value > 0).length / series.length;
  const forecaster = usedShare < INTERMITTENT_BELOW ? tsb : holt;
  const weekly = forecaster.predictNext(series);
  const { error, baselineError, rmse } = backtest(series, forecaster);
  const low = Math.max(0, weekly - RANGE_FACTOR * rmse);
  const high = weekly + RANGE_FACTOR * rmse;

  const beatsBaseline = error <= baselineError;
  const typical = mean(series.filter((value) => value > 0));
  const confidence: Confidence = !beatsBaseline ? "low" : error / Math.max(typical, 1) < 0.35 ? "high" : "medium";

  const stockoutAt = runOutDay(input.quantity, weekly, now);
  const within = stockoutAt !== null && new Date(stockoutAt).getTime() - now.getTime() <= REORDER_WITHIN_DAYS * DAY;
  const target = weekly * (LEAD_WEEKS + COVER_WEEKS) + SAFETY_FACTOR * rmse * Math.sqrt(LEAD_WEEKS);
  const reorderBy = stockoutAt ? new Date(Math.max(new Date(stockoutAt).getTime() - LEAD_WEEKS * 7 * DAY, now.getTime())) : null;

  const usage = `Uses about ${round(weekly)} ${unit} a week, and ${input.quantity} are left.`;
  const outlook = stockoutAt ? `Expect to run out around ${formatForecastDay(stockoutAt)}.` : "No stock-out expected within a year.";

  return {
    state: "ready",
    method: forecaster.name,
    weeklyDemand: round(weekly),
    weeklyLow: round(low),
    weeklyHigh: round(high),
    stockoutAt,
    stockoutEarliest: runOutDay(input.quantity, high, now),
    stockoutLatest: runOutDay(input.quantity, low, now),
    reorderQuantity: within ? Math.max(1, Math.ceil(target - input.quantity)) : null,
    reorderBy: within && reorderBy ? isoDay(reorderBy) : null,
    confidence,
    backtestError: round(error),
    baselineError: round(baselineError),
    reason: `${usage} ${outlook}`,
  };
}

const numbersIn = (text: string) => text.match(/\d+(?:\.\d+)?/g) ?? [];

/** An AI rewrite is kept only if it has exactly the same numbers, so it can't change a figure. */
export function keepsTheNumbers(original: string, rewrite: string) {
  const expected = new Set(numbersIn(original));
  const found = new Set(numbersIn(rewrite));
  return rewrite.length > 0 && rewrite.length <= 300 && expected.size === found.size && [...expected].every((number) => found.has(number));
}
