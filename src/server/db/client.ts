import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

const create = (connectionString: string) => drizzle(new Pool({ connectionString, max: 10 }), { schema });

let appDb: ReturnType<typeof create> | undefined;
let authDb: ReturnType<typeof create> | undefined;

/** Restricted by RLS. All office data goes through runScoped(getDb(), ...). */
export function getDb() {
  return (appDb ??= create(env().DATABASE_URL));
}

/** Can read accounts before a scope exists. Used only by sign-in and session lookup. */
export function getAuthDb() {
  return (authDb ??= create(env().DATABASE_AUTH_URL));
}
