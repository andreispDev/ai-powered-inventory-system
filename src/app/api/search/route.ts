import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { itemPath } from "@/modules/inventory/kinds";
import { getActor } from "@/server/auth/session";
import { appUser, category, item, office } from "@/server/db/schema";
import { AppError } from "@/server/guard/errors";
import { readScoped } from "@/server/guard/read";

const LIMIT = 5;

export type SearchResult = { group: string; label: string; detail: string | null; href: string };

/** Search for the command palette. RLS and permissions decide what comes back. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return Response.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
  if (!q || q.length < 2) return Response.json({ results: [] });

  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);

  try {
    const results = await readScoped(actor, async (tx) => {
      const found: SearchResult[] = [];
      if (can("item.read")) {
        const rows = await tx
          .select({ id: item.id, name: item.name, sku: item.sku, kind: category.kind })
          .from(item)
          .innerJoin(category, eq(item.categoryId, category.id))
          .where(and(isNull(item.deletedAt), or(ilike(item.name, like), ilike(item.sku, like), ilike(item.serialNumber, like))))
          .orderBy(asc(item.name))
          .limit(LIMIT);
        found.push(...rows.map((row) => ({ group: row.kind === "records" ? "Records" : "Items", label: row.name, detail: row.sku, href: itemPath(row.kind, row.id) })));
      }
      if (can("category.read")) {
        const rows = await tx.select({ id: category.id, name: category.name }).from(category).where(ilike(category.name, like)).orderBy(asc(category.name)).limit(LIMIT);
        found.push(...rows.map((row) => ({ group: "Categories", label: row.name, detail: null, href: `/categories/${row.id}` })));
      }
      if (can("user.read")) {
        const rows = await tx
          .select({ id: appUser.id, name: appUser.name, email: appUser.email })
          .from(appUser)
          .where(or(ilike(appUser.name, like), ilike(appUser.email, like)))
          .orderBy(asc(appUser.name))
          .limit(LIMIT);
        found.push(...rows.map((row) => ({ group: "People", label: row.name, detail: row.email, href: `/accounts/${row.id}` })));
      }
      if (can("office.manage")) {
        const rows = await tx
          .select({ id: office.id, name: office.name, code: office.code })
          .from(office)
          .where(or(ilike(office.name, like), ilike(office.code, like)))
          .orderBy(asc(office.name))
          .limit(LIMIT);
        found.push(...rows.map((row) => ({ group: "Offices", label: row.name, detail: row.code, href: `/console/offices/${row.id}` })));
      }
      return found;
    });
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") return Response.json({ results: [] }, { status: 429 });
    throw error;
  }
}
