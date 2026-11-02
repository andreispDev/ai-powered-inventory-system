import { asc, count, ilike, or, sql } from "drizzle-orm";
import { Eye, Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { TablePagination, TableSearch } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { ArchiveOfficeButton } from "@/modules/offices/archive-button";
import { requireActor } from "@/server/auth/session";
import { appUser, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Offices" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("office.manage")) return <AccessDenied />;

  const params = await searchParams;
  const { page, pageSize, offset } = parsePage(params);
  const q = param(params, "q")?.trim();
  const where = q
    ? or(ilike(office.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`), ilike(office.code, `%${q.replace(/[\\%_]/g, "\\$&")}%`))
    : undefined;

  const { rows, total } = await readScoped(actor, async (tx) => {
    const rows = await tx
      .select({
        id: office.id,
        code: office.code,
        name: office.name,
        status: office.status,
        people: sql<number>`(select count(*)::int from ${appUser} where ${appUser.officeId} = ${office.id})`,
      })
      .from(office)
      .where(where)
      .orderBy(asc(office.name))
      .limit(pageSize)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(office).where(where);
    return { rows, total };
  });

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Offices"
        description="Each office only sees its own data."
        actions={
          <Button asChild>
            <Link href="/console/offices/new">
              <Plus aria-hidden />
              New office
            </Link>
          </Button>
        }
      />
      <TableSearch placeholder="Search offices…" />
      {total === 0 ? (
        <EmptyState
          icon={Building2}
          title={q ? "No offices match" : "No offices yet"}
          description={q ? "Try a different search." : "Create the first office, then add its admin."}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">People</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/console/offices/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.people}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                      {row.status === "active" ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <RowLink href={`/console/offices/${row.id}`} icon={Eye} label="View" />
                      <ArchiveOfficeButton id={row.id} archived={row.status !== "active"} size="sm" />
                    </RowActions>
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

export default function OfficesPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
