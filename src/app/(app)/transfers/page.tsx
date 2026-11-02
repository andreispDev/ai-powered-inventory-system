import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TableFilter, TablePagination } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { listTransfers } from "@/modules/custody/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Transfers" };

type Props = { searchParams: Promise<SearchParams> };

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("transfer.create") && !can("transfer.respond") && !can("monitor.all")) return <AccessDenied />;

  const params = await searchParams;
  const { page, pageSize, offset } = parsePage(params);
  const statusParam = param(params, "status");
  const status = STATUSES.some((s) => s.value === statusParam) ? statusParam : undefined;
  const { rows, total } = await readScoped(actor, (tx) =>
    listTransfers(tx, { status, officeId: actor.officeId, direction: param(params, "direction") }, pageSize, offset),
  );

  return (
    <PageContainer width="wide">
      <PageHeader title="Transfers" description="Start a transfer from an item's page. Stock moves when the other office accepts." />
      <div className="flex flex-wrap gap-2">
        <TableFilter name="status" label="Status" options={STATUSES} />
        {actor.officeId && (
          <TableFilter
            name="direction"
            label="Direction"
            options={[
              { value: "incoming", label: "Coming to us" },
              { value: "outgoing", label: "Going out" },
            ]}
          />
        )}
      </div>
      {total === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers to show" description="Transfers between offices appear here." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/transfers/${row.id}`} className="font-medium hover:underline">
                      {row.itemName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quantity} {row.unit}
                  </TableCell>
                  <TableCell>{row.fromOfficeName}</TableCell>
                  <TableCell>{row.toOfficeName}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "pending" ? "default" : row.status === "accepted" ? "secondary" : "outline"} className="capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <LocalTime date={row.createdAt} />
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

export default function TransfersPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
