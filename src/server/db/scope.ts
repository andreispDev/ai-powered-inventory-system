import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type ScopedTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type Scope =
  | { kind: "office"; officeId: string; userId: string }
  | { kind: "platform"; userId: string };

/**
 * Runs fn in a transaction limited to one office, or to platform scope.
 * The settings end with the transaction, and with no scope set RLS returns no rows.
 */
export function runScoped<T>(db: Db, scope: Scope, fn: (tx: ScopedTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const officeId = scope.kind === "office" ? scope.officeId : "";
    await tx.execute(
      sql`select set_config('app.office_id', ${officeId}, true),
                 set_config('app.scope', ${scope.kind}, true),
                 set_config('app.user_id', ${scope.userId}, true)`,
    );
    return fn(tx);
  });
}
