import { UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TablePagination } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { ReturnButton } from "@/modules/custody/custody-actions";
import { listOpenAssignments } from "@/modules/custody/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Assignments" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("assignment.manage")) return <AccessDenied />;
  const { page, pageSize, offset } = parsePage(await searchParams);
  const { rows, total } = await readScoped(actor, (tx) => listOpenAssignments(tx, pageSize, offset));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer width="wide">
      <PageHeader title="Assignments" description="Who has what right now. Assign items from their page." />
      {total === 0 ? (
        <EmptyState icon={UserCheck} title="Nothing is assigned" description="Open an item and choose Assign to give it to someone." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>With</TableHead>
                <TableHead>Since</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Return by</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/inventory/${row.itemId}`} className="font-medium hover:underline">
                      {row.itemName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.assigneeName}</TableCell>
                  <TableCell>{row.since}</TableCell>
                  <TableCell>{row.assignedByName}</TableCell>
                  <TableCell className={row.dueAt && row.dueAt < today ? "text-destructive font-medium" : undefined}>
                    {row.dueAt ?? "—"}
                    {row.dueAt && row.dueAt < today ? " (overdue)" : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <ReturnButton id={row.id} name={row.assigneeName} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function AssignmentsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
