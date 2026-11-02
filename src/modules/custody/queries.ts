import "server-only";
import { aliasedTable, and, count, desc, eq, isNull, or } from "drizzle-orm";
import { appUser, assignment, item, transfer } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";

const assignee = aliasedTable(appUser, "assignee");
const assigner = aliasedTable(appUser, "assigner");

const assignmentFields = {
  id: assignment.id,
  itemId: assignment.itemId,
  since: assignment.since,
  dueAt: assignment.dueAt,
  returnedAt: assignment.returnedAt,
  note: assignment.note,
  assigneeName: assignee.name,
  assignedByName: assigner.name,
};

export const listItemAssignments = (tx: ScopedTx, itemId: string) =>
  tx
    .select(assignmentFields)
    .from(assignment)
    .innerJoin(assignee, eq(assignment.assigneeId, assignee.id))
    .innerJoin(assigner, eq(assignment.assignedBy, assigner.id))
    .where(eq(assignment.itemId, itemId))
    .orderBy(desc(assignment.createdAt))
    .limit(30);

export async function listOpenAssignments(tx: ScopedTx, limit: number, offset: number) {
  const where = isNull(assignment.returnedAt);
  const rows = await tx
    .select({ ...assignmentFields, itemName: item.name })
    .from(assignment)
    .innerJoin(assignee, eq(assignment.assigneeId, assignee.id))
    .innerJoin(assigner, eq(assignment.assignedBy, assigner.id))
    .innerJoin(item, eq(assignment.itemId, item.id))
    .where(where)
    .orderBy(desc(assignment.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await tx.select({ total: count() }).from(assignment).where(where);
  return { rows, total };
}

export async function listTransfers(tx: ScopedTx, filter: { status?: string; officeId: string | null; direction?: string }, limit: number, offset: number) {
  const where = and(
    filter.status ? eq(transfer.status, filter.status as "pending") : undefined,
    filter.officeId && filter.direction === "incoming" ? eq(transfer.toOfficeId, filter.officeId) : undefined,
    filter.officeId && filter.direction === "outgoing" ? eq(transfer.fromOfficeId, filter.officeId) : undefined,
    filter.officeId ? or(eq(transfer.toOfficeId, filter.officeId), eq(transfer.fromOfficeId, filter.officeId)) : undefined,
  );
  const rows = await tx.select().from(transfer).where(where).orderBy(desc(transfer.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await tx.select({ total: count() }).from(transfer).where(where);
  return { rows, total };
}

export async function getTransfer(tx: ScopedTx, id: string) {
  const [row] = await tx.select().from(transfer).where(eq(transfer.id, id));
  return row;
}
