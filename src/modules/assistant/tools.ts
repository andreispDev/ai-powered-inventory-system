// What the assistant can look up. Read-only, and every call runs in the asking person's RLS scope.
import { and, asc, cosineDistance, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Permission } from "../../server/authz/catalog";
import { itemPath } from "../inventory/kinds";
import { appUser, assignment, category, categoryField, forecast, item, itemEmbedding, office, stockMovement } from "../../server/db/schema";
import type { ScopedTx } from "../../server/db/scope";

export type Source = { label: string; href: string };
/** queryVector is the search text's meaning, worked out before the transaction. Without it, search uses keywords alone. */
export type ToolContext = { tx: ScopedTx; permissions: readonly Permission[]; now: Date; queryVector?: number[] | null };
/** empty means the records hold nothing for this question, so the model has nothing to answer from. */
export type ToolResult = { data: unknown; sources: Source[]; empty?: boolean };

type Tool<S extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  permission: Permission;
  input: S;
  run: (ctx: ToolContext, input: z.output<S>) => Promise<ToolResult>;
};

const define = <S extends z.ZodType>(tool: Tool<S>) => tool as unknown as Tool;

const MAX_ROWS = 10;
const STOP_WORDS = new Set(["the", "any", "all", "and", "for", "with", "our", "old", "new", "item", "items", "stock", "many", "much", "how", "in", "of", "on", "at", "to", "is", "or", "an", "by", "we", "do", "have", "office", "offices", "what", "which", "where", "please"]);

// Small models send "" or "null" for arguments they want to skip.
const blank = (value: unknown) => (value === "" || value === "null" || value === null ? undefined : value);
const text = () => z.preprocess(blank, z.string().trim().max(200).optional());

/** The words worth searching for, with plurals trimmed so "laptops" finds "Laptop". */
export function searchWords(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}-]{2,}/gu) ?? [];
  const kept = words.filter((word) => !STOP_WORDS.has(word)).map((word) => (word.length > 3 ? word.replace(/s$/, "") : word));
  return [...new Set(kept)].slice(0, 6);
}

const contains = (word: string) => `%${word.replace(/[\\%_]/g, "\\$&")}%`;

function matches(query: string, every = true): SQL | undefined {
  const columns = [item.name, item.sku, item.notes, item.supplier, item.location, category.name];
  const words = searchWords(query).map((word) => or(...columns.map((column) => ilike(column, contains(word)))));
  return every ? and(...words) : or(...words);
}

const itemRows = (tx: ScopedTx, where: SQL | undefined, limit = MAX_ROWS) =>
  tx
    .select({
      id: item.id,
      name: item.name,
      sku: item.sku,
      kind: category.kind,
      category: category.name,
      office: office.name,
      status: item.status,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
    })
    .from(item)
    .innerJoin(category, eq(item.categoryId, category.id))
    .innerJoin(office, eq(item.officeId, office.id))
    .where(and(isNull(item.deletedAt), where))
    .orderBy(asc(item.name))
    .limit(limit);

// How far apart a match may be, by cosine distance. In a small test with nomic-embed-text, right
// matches were within 0.38 and unrelated questions beyond 0.49. Changing the model means re-measuring.
export const MAX_DISTANCE = 0.4;
const RRF_K = 60;

/** Items closest in meaning. RLS keeps this to what the person may see. */
const similarItemIds = async (tx: ScopedTx, queryVector: number[]) => {
  const distance = cosineDistance(itemEmbedding.embedding, queryVector);
  const rows = await tx.select({ id: itemEmbedding.itemId }).from(itemEmbedding).where(lte(distance, MAX_DISTANCE)).orderBy(distance).limit(MAX_ROWS);
  return rows.map((row) => row.id);
};

/** Reciprocal rank fusion: being near the top of either list counts, and of both counts most. */
export function mergeRanked(lists: readonly (readonly string[])[], limit = MAX_ROWS) {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1)));
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

const itemSource = (row: { id: string; name: string; kind?: "stock" | "records" }): Source => ({ label: row.name, href: itemPath(row.kind ?? "stock", row.id) });
const withoutId = <T extends { id: string }>(row: T): Omit<T, "id"> => {
  const { id, ...rest } = row;
  void id;
  return rest;
};

/** A record's zero quantity means nothing, and would read as "out of stock". */
const describeItem = <T extends { id: string; kind: "stock" | "records"; quantity: number; unit: string; status: string }>(row: T) => {
  const { kind, quantity, unit, status, ...rest } = withoutId(row) as Omit<T, "id">;
  return kind === "records" ? { ...rest, type: "record" } : { ...rest, status, quantity, unit };
};

export const TOOLS: Tool[] = [
  define({
    name: "search_items",
    description: "Find stock items and records (such as work papers) by name, reference, notes, supplier, location, category or meaning. Handles fuzzy questions like 'anything like the old projectors'.",
    permission: "item.read",
    input: z.object({ query: z.string().trim().min(1).max(200) }),
    async run({ tx, queryVector }, { query }) {
      const where = matches(query);
      const exact = where ? await itemRows(tx, where) : [];
      // Records matching every word first. Failing that, any word, and the model is told they're only close.
      const keyword = exact.length > 0 || !where ? exact : await itemRows(tx, matches(query, false));
      const similar = queryVector ? await similarItemIds(tx, queryVector) : [];
      const order = mergeRanked([keyword.map((row) => row.id), similar]);
      const found = order.length > 0 ? await itemRows(tx, inArray(item.id, order)) : [];
      const rows = found.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      return {
        data: { found: rows.length, closeMatchesOnly: exact.length === 0 && rows.length > 0, items: rows.map(describeItem) },
        sources: rows.map(itemSource),
        empty: rows.length === 0,
      };
    },
  }),
  define({
    name: "get_item",
    description: "Full details of one item, found by its name.",
    permission: "item.read",
    input: z.object({ name: z.string().trim().min(1).max(200) }),
    async run({ tx }, { name }) {
      const [match] = await itemRows(tx, matches(name) ?? sql`false`, 1);
      if (!match) return { data: { found: false }, sources: [], empty: true };
      const [extra] = await tx
        .select({
          serialNumber: item.serialNumber,
          condition: item.condition,
          supplier: item.supplier,
          purchaseDate: item.purchaseDate,
          warrantyExpiry: item.warrantyExpiry,
          notes: item.notes,
          customFields: item.attributes,
        })
        .from(item)
        .where(eq(item.id, match.id));
      return { data: { found: true, ...describeItem(match), ...extra }, sources: [itemSource(match)] };
    },
  }),
  define({
    name: "aggregate_inventory",
    description: "Exact counts of stock items and records, with total stock quantity, optionally grouped and filtered. Use for any 'how many' question.",
    permission: "item.read",
    input: z.object({
      group_by: z.preprocess(blank, z.enum(["category", "status", "location", "office"]).optional()),
      search: text(),
      out_of_stock_only: z.preprocess(blank, z.stringbool().optional()),
    }),
    async run({ tx }, { group_by, search, out_of_stock_only }) {
      const dimension = group_by === "category" ? category.name : group_by === "status" ? sql<string>`${item.status}::text` : group_by === "location" ? item.location : group_by === "office" ? office.name : sql<string>`'all'`;
      const rows = await tx
        .select({
          group: dimension,
          differentItems: count(),
          stockItems: sql<number>`(count(*) filter (where ${category.kind} = 'stock'))::int`,
          records: sql<number>`(count(*) filter (where ${category.kind} = 'records'))::int`,
          // Records aren't counted stock, so their quantity never adds to the units.
          totalUnits: sql<number>`coalesce(sum(${item.quantity}) filter (where ${category.kind} = 'stock'), 0)::int`,
        })
        .from(item)
        .innerJoin(category, eq(item.categoryId, category.id))
        .innerJoin(office, eq(item.officeId, office.id))
        .where(and(isNull(item.deletedAt), out_of_stock_only ? and(eq(category.kind, "stock"), eq(item.quantity, 0)) : undefined, search ? (matches(search) ?? sql`false`) : undefined))
        .groupBy(...(group_by ? [dimension] : []))
        .orderBy(desc(count()))
        .limit(20);
      // Without a grouping, the database answers with one row of zeros when nothing matches.
      const found = rows.filter((row) => row.differentItems > 0);
      // A ready-made sentence, because small models tend to call every number "items".
      const results = found.map((row) => {
        const parts = [row.stockItems ? `${row.stockItems} stock items (${row.totalUnits} units in total)` : "", row.records ? `${row.records} records` : ""].filter(Boolean);
        return { ...row, summary: `${parts.join(" and ")}${group_by ? ` in ${row.group ?? "none"}` : ""}` };
      });
      return { data: { results }, sources: [], empty: found.length === 0 && !out_of_stock_only };
    },
  }),
  define({
    name: "list_movements",
    description: "Stock history: what was received, issued, returned or adjusted, with exact totals. Use for 'how many were issued last month' questions.",
    permission: "item.read",
    input: z.object({
      item: text(),
      type: z.preprocess(blank, z.enum(["receive", "issue", "adjust", "return", "transfer_out", "transfer_in"]).optional()),
      days: z.preprocess(blank, z.coerce.number().int().min(1).max(730).default(30)),
    }),
    async run({ tx, now }, { item: search, type, days }) {
      const where = and(
        isNull(item.deletedAt),
        search ? (matches(search) ?? sql`false`) : undefined,
        type ? eq(stockMovement.type, type) : undefined,
        gte(stockMovement.occurredAt, new Date(now.getTime() - days * 86_400_000)),
      );
      const from = () =>
        tx
          .select({ id: item.id, name: item.name, type: stockMovement.type, change: stockMovement.delta, at: stockMovement.occurredAt, reason: stockMovement.reason, count: sql<number>`count(*) over ()::int`, units: sql<number>`sum(abs(${stockMovement.delta})) over ()::int` })
          .from(stockMovement)
          .innerJoin(item, eq(stockMovement.itemId, item.id))
          .innerJoin(category, eq(item.categoryId, category.id))
          .where(where)
          .orderBy(desc(stockMovement.occurredAt))
          .limit(MAX_ROWS);
      const rows = await from();
      const seen = new Map(rows.map((row) => [row.id, row]));
      return {
        data: {
          periodDays: days,
          totalMovements: rows[0]?.count ?? 0,
          totalUnits: rows[0]?.units ?? 0,
          latest: rows.map((row) => ({ item: row.name, type: row.type, change: row.change, date: row.at.toISOString().slice(0, 10), reason: row.reason })),
        },
        sources: [...seen.values()].map(itemSource),
        empty: rows.length === 0 && !!search,
      };
    },
  }),
  define({
    name: "list_assignments",
    description: "Who currently has which item, and when it is due back.",
    permission: "assignment.manage",
    input: z.object({ search: text(), overdue_only: z.preprocess(blank, z.stringbool().optional()) }),
    async run({ tx, now }, { search, overdue_only }) {
      const words = search ? searchWords(search) : [];
      const rows = await tx
        .select({ id: item.id, name: item.name, person: appUser.name, since: assignment.since, dueAt: assignment.dueAt })
        .from(assignment)
        .innerJoin(item, eq(assignment.itemId, item.id))
        .innerJoin(appUser, eq(assignment.assigneeId, appUser.id))
        .where(
          and(
            isNull(assignment.returnedAt),
            overdue_only ? sql`${assignment.dueAt} < ${now.toISOString().slice(0, 10)}` : undefined,
            or(...words.flatMap((word) => [ilike(item.name, contains(word)), ilike(appUser.name, contains(word))])),
          ),
        )
        .orderBy(asc(assignment.dueAt))
        .limit(MAX_ROWS);
      return { data: { assignments: rows.map(withoutId) }, sources: rows.map(itemSource), empty: rows.length === 0 };
    },
  }),
  define({
    name: "get_forecast",
    description: "Stored predictions: when stock will run out and what to reorder. Leave item empty for the soonest stock-outs.",
    permission: "ai.forecast.read",
    input: z.object({ item: text() }),
    async run({ tx }, { item: search }) {
      const rows = await tx
        .select({ id: item.id, name: item.name, runsOut: forecast.stockoutAt, weeklyUse: forecast.weeklyDemand, reorderQuantity: forecast.reorderQuantity, reorderBy: forecast.reorderBy, confidence: forecast.confidence, state: forecast.state })
        .from(forecast)
        .innerJoin(item, eq(forecast.itemId, item.id))
        .innerJoin(category, eq(item.categoryId, category.id))
        .where(and(isNull(item.deletedAt), search ? (matches(search) ?? sql`false`) : sql`${forecast.stockoutAt} is not null`))
        .orderBy(sql`${forecast.stockoutAt} asc nulls last`)
        .limit(MAX_ROWS);
      return { data: { forecasts: rows.map(withoutId) }, sources: rows.map(itemSource), empty: rows.length === 0 };
    },
  }),
  define({
    name: "describe_categories",
    description: "Which categories exist and which custom columns each has.",
    permission: "category.read",
    input: z.object({}),
    async run({ tx }) {
      const rows = await tx.select({ id: category.id, name: category.name }).from(category).where(isNull(category.archivedAt)).orderBy(asc(category.name)).limit(30);
      const fields = await tx.select({ categoryId: categoryField.categoryId, label: categoryField.label }).from(categoryField).where(isNull(categoryField.retiredAt));
      return {
        data: { categories: rows.map((row) => ({ name: row.name, columns: fields.filter((field) => field.categoryId === row.id).map((field) => field.label) })) },
        sources: rows.map((row) => ({ label: row.name, href: `/categories/${row.id}` })),
      };
    },
  }),
];

export const toolsFor = (permissions: readonly Permission[]) => TOOLS.filter((tool) => permissions.includes(tool.permission));

/** The tool list in the format Ollama expects. */
export const toolSchemas = (tools: readonly Tool[]) =>
  tools.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }) },
  }));

/** Never throws for bad model output: the error goes back to the model as a result. */
export async function runTool(ctx: ToolContext, name: string, args: unknown): Promise<ToolResult> {
  const tool = toolsFor(ctx.permissions).find((candidate) => candidate.name === name);
  if (!tool) return { data: { error: `There is no tool named ${name} available.` }, sources: [], empty: true };
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) return { data: { error: "Those arguments aren't valid.", details: z.flattenError(parsed.error).fieldErrors }, sources: [], empty: true };
  return tool.run(ctx, parsed.data);
}
