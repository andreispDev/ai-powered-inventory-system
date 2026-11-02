import { auditLog } from "../db/schema";
import type { ScopedTx } from "../db/scope";
import type { Role } from "../authz/catalog";

export type AuditEntry = {
  actor: { id: string; role: Role; officeId: string | null };
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  ip?: string | null;
  /** Defaults to the actor's office */
  officeId?: string | null;
};

/** Takes the caller's transaction, so a change and its log entry succeed or fail together. */
export async function writeAudit(tx: ScopedTx, entry: AuditEntry) {
  await tx.insert(auditLog).values({
    officeId: entry.officeId === undefined ? entry.actor.officeId : entry.officeId,
    actorId: entry.actor.id,
    actorRole: entry.actor.role,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    requestId: entry.requestId,
    ip: entry.ip,
  });
}
