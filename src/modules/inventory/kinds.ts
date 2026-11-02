// Stock categories hold counted items. Records categories hold anything else, such as work papers.
// Both live in the item table, so everything about stock must filter by kind.
import { sql } from "drizzle-orm";
import { category, item } from "../../server/db/schema";

export type CategoryKind = "stock" | "records";

export const itemIsKind = (kind: CategoryKind) =>
  sql`exists (select 1 from ${category} where ${category.id} = ${item.categoryId} and ${category.kind} = ${kind})`;

export const itemPath = (kind: CategoryKind, id: string) => `/${kind === "records" ? "records" : "inventory"}/${id}`;
