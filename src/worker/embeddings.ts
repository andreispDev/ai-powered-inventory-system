// Keeps each item's meaning-search vector current. No Redis here, so tests can run it directly.
import { createHash } from "node:crypto";
import { eq, isNull, sql } from "drizzle-orm";
import { EMBEDDING_MODEL, type Embedder } from "../server/ai/ollama";
import { category, item, itemEmbedding } from "../server/db/schema";
import type { ScopedTx } from "../server/db/scope";

const BATCH_SIZE = 32;
const LOOKS_LIKE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

type Source = {
  name: string;
  sku: string | null;
  notes: string | null;
  supplier: string | null;
  location: string | null;
  condition: string | null;
  categoryName: string;
  attributes: Record<string, unknown>;
};

/** What the vector describes. Custom column values count, but not IDs, which carry no meaning. */
export function embeddingText(row: Source): string {
  const values = Object.values(row.attributes)
    .flat()
    .filter((value) => (typeof value === "string" && !LOOKS_LIKE_ID.test(value)) || typeof value === "number")
    .map(String);
  return [row.name, row.categoryName, row.sku, row.supplier, row.location, row.condition, row.notes, ...values].filter(Boolean).join(". ");
}

const hashOf = (text: string) => createHash("sha256").update(`${EMBEDDING_MODEL}\n${text}`).digest("hex");

export type StaleItem = { itemId: string; officeId: string; text: string; contentHash: string };

/** Items never embedded, or changed since. The hash means an unchanged item costs nothing. */
export async function findStaleItems(tx: ScopedTx, limit = BATCH_SIZE): Promise<StaleItem[]> {
  const rows = await tx
    .select({
      itemId: item.id,
      officeId: item.officeId,
      name: item.name,
      sku: item.sku,
      notes: item.notes,
      supplier: item.supplier,
      location: item.location,
      condition: item.condition,
      attributes: item.attributes,
      categoryName: category.name,
      savedHash: itemEmbedding.contentHash,
    })
    .from(item)
    .innerJoin(category, eq(item.categoryId, category.id))
    .leftJoin(itemEmbedding, eq(itemEmbedding.itemId, item.id))
    .where(isNull(item.deletedAt));
  const stale: StaleItem[] = [];
  for (const row of rows) {
    const text = embeddingText(row);
    const contentHash = hashOf(text);
    if (contentHash !== row.savedHash) stale.push({ itemId: row.itemId, officeId: row.officeId, text, contentHash });
    if (stale.length >= limit) break;
  }
  return stale;
}

export async function saveEmbeddings(tx: ScopedTx, items: readonly StaleItem[], vectors: readonly number[][]) {
  for (const [index, row] of items.entries()) {
    const values = { contentHash: row.contentHash, embedding: vectors[index], updatedAt: sql`now()` };
    await tx
      .insert(itemEmbedding)
      .values({ itemId: row.itemId, officeId: row.officeId, ...values })
      .onConflictDoUpdate({ target: itemEmbedding.itemId, set: values });
  }
}

/** Works through the backlog. The model runs outside any transaction, because it can take a while. */
export async function refreshEmbeddings(run: <T>(fn: (tx: ScopedTx) => Promise<T>) => Promise<T>, embedder: Embedder, maxBatches = 50) {
  let done = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const stale = await run((tx) => findStaleItems(tx));
    if (stale.length === 0) break;
    const vectors = await embedder.embedDocuments(stale.map((row) => row.text));
    await run((tx) => saveEmbeddings(tx, stale, vectors));
    done += stale.length;
  }
  return done;
}
