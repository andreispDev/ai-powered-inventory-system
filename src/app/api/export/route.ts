import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ExportTable } from "@/lib/export-format";
import { param, type SearchParams } from "@/lib/pagination";
import { logWhere } from "@/modules/audit/log-filter";
import { getCategory, listCategories, listFields } from "@/modules/categories/queries";
import { withDescendants } from "@/modules/categories/tree";
import { formatAttribute, statusLabel } from "@/modules/inventory/format";
import { listItems, listPeople } from "@/modules/inventory/queries";
import { writeAudit } from "@/server/audit/writer";
import { getActor, type Actor } from "@/server/auth/session";
import { appUser, auditLog, office } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";
import { readScoped } from "@/server/guard/read";
import { checkLimit } from "@/server/rate-limit";

const MAX_ROWS = 5000;

const fail = (status: number, message: string) => Response.json({ message }, { status });

async function itemTable(tx: ScopedTx, actor: Actor, params: SearchParams, kind: "stock" | "records"): Promise<ExportTable> {
  const requested = param(params, "category");
  const categoryId = z.uuid().safeParse(requested).success ? requested : undefined;
  const categories = (await listCategories(tx)).filter((row) => row.kind === kind);
  // The same rule as the table: one category's columns need one category in view.
  const fieldsCategoryId = categoryId ?? (categories.length === 1 ? categories[0].id : undefined);
  const fields = fieldsCategoryId ? await listFields(tx, fieldsCategoryId) : [];
  const attributes: Record<string, string> = {};
  for (const field of fields) {
    const value = param(params, `f_${field.key}`);
    if (value) attributes[field.key] = value;
  }
  const canRestore = actor.permissions.includes("item.restore");
  const { rows, total } = await listItems(tx, {
    kind,
    q: param(params, "q")?.trim() || undefined,
    categoryIds: categoryId ? withDescendants(categories, categoryId) : undefined,
    status: kind === "stock" ? param(params, "status") : undefined,
    deleted: canRestore && param(params, "view") === "deleted",
    sort: param(params, "sort"),
    direction: param(params, "dir") === "desc" ? "desc" : "asc",
    attributes,
    fields,
    offset: 0,
    limit: MAX_ROWS,
  });
  const people = fields.some((field) => field.type === "person") ? Object.fromEntries((await listPeople(tx)).map((person) => [person.id, person.name])) : {};
  const selected = fieldsCategoryId ? await getCategory(tx, fieldsCategoryId) : undefined;
  const showLocation = !selected?.disabledFields.includes("location");
  const showOffice = !actor.officeId;
  const isStock = kind === "stock";

  return {
    title: isStock ? "Inventory" : "Records",
    columns: [
      "Name",
      "Category",
      ...(showOffice ? ["Office"] : []),
      ...(isStock ? ["Quantity", "Unit", "Status"] : []),
      ...(showLocation ? ["Location"] : []),
      ...fields.map((field) => field.label),
      "Added by",
      "Date added",
    ],
    rows: rows.map((row) => [
      row.name,
      row.categoryName,
      ...(showOffice ? [row.officeName] : []),
      ...(isStock ? [String(row.quantity), row.unit, statusLabel(row.status)] : []),
      ...(showLocation ? [row.location ?? ""] : []),
      ...fields.map((field) => {
        const text = formatAttribute(row.attributes[field.key], field, people);
        return text === "—" ? "" : text;
      }),
      row.createdByName ?? "",
      row.createdAt.toISOString().slice(0, 10),
    ]),
    total,
    truncated: total > rows.length,
  };
}

async function logTable(tx: ScopedTx, actor: Actor, params: SearchParams): Promise<ExportTable> {
  const where = logWhere(params, actor);
  const rows = await tx
    .select({ at: auditLog.at, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId, actorName: appUser.name, officeName: office.name })
    .from(auditLog)
    .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
    .leftJoin(office, eq(auditLog.officeId, office.id))
    .where(where)
    .orderBy(desc(auditLog.id))
    .limit(MAX_ROWS + 1);
  const showOffice = actor.permissions.includes("audit.read.all");
  const kept = rows.slice(0, MAX_ROWS);
  return {
    title: "Logs",
    columns: ["When (UTC)", "Who", ...(showOffice ? ["Office"] : []), "Action", "Record"],
    rows: kept.map((row) => [
      row.at.toISOString().replace("T", " ").slice(0, 19),
      row.actorName ?? "System",
      ...(showOffice ? [row.officeName ?? ""] : []),
      row.action,
      row.entityType ? `${row.entityType} ${row.entityId ?? ""}`.trim() : "",
    ]),
    total: kept.length,
    truncated: rows.length > MAX_ROWS,
  };
}

/** The rows behind an export, following the table's filters. The browser builds the file from them. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return fail(401, "Sign in again.");
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("export.run")) return fail(403, "You don't have permission to export.");

  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset");
  const params: SearchParams = Object.fromEntries(url.searchParams);
  const canRead = dataset === "logs" ? can("audit.read.all") || can("audit.read.office") || can("audit.read.own") : dataset === "inventory" || dataset === "records" ? can("item.read") : null;
  if (canRead === null) return fail(404, "Unknown export.");
  if (!canRead) return fail(403, "You don't have permission to export this.");

  const limit = await checkLimit("bulk", actor.id);
  if (!limit.ok) return fail(429, "Too many exports. Please wait a moment.");

  const table = await readScoped(actor, async (tx) => {
    const built = dataset === "logs" ? await logTable(tx, actor, params) : await itemTable(tx, actor, params, dataset === "records" ? "records" : "stock");
    await writeAudit(tx, {
      actor,
      action: "data.exported",
      entityType: "export",
      // Developers export across offices, so this isn't tied to one.
      after: { dataset, rows: built.rows.length, filters: Object.fromEntries(url.searchParams) },
    });
    return built;
  });
  return Response.json(table, { headers: { "Cache-Control": "no-store" } });
}
