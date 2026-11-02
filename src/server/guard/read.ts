import "server-only";
import { scopeOf, type Actor } from "../auth/session";
import { getDb } from "../db/client";
import { runScoped, type ScopedTx } from "../db/scope";
import { checkLimit } from "../rate-limit";
import { AppError } from "./errors";

/** The only way to read office data: rate limited, and limited to the person's scope by RLS. */
export async function readScoped<T>(actor: Actor, fn: (tx: ScopedTx) => Promise<T>): Promise<T> {
  const limit = await checkLimit("read", actor.id);
  if (!limit.ok) throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment.");
  return runScoped(getDb(), scopeOf(actor), fn);
}
