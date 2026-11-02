import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { writeAudit, type AuditEntry } from "../audit/writer";
import { getActor, scopeOf, type Actor } from "../auth/session";
import type { Permission } from "../authz/catalog";
import { getDb } from "../db/client";
import { runScoped, type ScopedTx } from "../db/scope";
import { AppError, type ActionResult } from "./errors";

type Context<I> = {
  input: I;
  actor: Actor;
  tx: ScopedTx;
  /** Records the change in this transaction */
  audit: (entry: Omit<AuditEntry, "actor" | "requestId" | "ip">) => Promise<void>;
};

/** The only way to write a mutation: session, permission, validation, then a scoped transaction. */
export function guard<S extends z.ZodType, R>(config: {
  permission: Permission;
  input: S;
  run: (ctx: Context<z.output<S>>) => Promise<R>;
}) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const actor = await getActor();
      if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
      if (!actor.permissions.includes(config.permission)) {
        throw new AppError("FORBIDDEN", "You don't have permission to do this.");
      }

      const parsed = config.input.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Please check the highlighted fields.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }

      const requestHeaders = await headers();
      const requestId = requestHeaders.get("x-request-id");
      const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      const data = await runScoped(getDb(), scopeOf(actor), (tx) =>
        config.run({
          input: parsed.data,
          actor,
          tx,
          audit: (entry) => writeAudit(tx, { ...entry, actor, requestId, ip }),
        }),
      );
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
      console.error(error);
      return { ok: false, code: "INTERNAL", message: "Something went wrong. Your changes weren't saved." };
    }
  };
}
