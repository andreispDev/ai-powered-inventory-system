import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { TableFilter, TablePagination, TableSearch } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { EditAccountButton } from "@/modules/accounts/edit-account-dialog";
import { AccountStatusButton } from "@/modules/accounts/status-button";
import { requireActor } from "@/server/auth/session";
import { appUser, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Accounts" };

type Props = { searchParams: Promise<SearchParams> };

const ROLES = [
  { value: "developer", label: "Developer" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];
const STATUS = { invited: "Invited", active: "Active", deactivated: "Deactivated" } as const;

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("user.read")) return <AccessDenied />;

  const params = await searchParams;
  const { page, pageSize, offset } = parsePage(params);
  const q = param(params, "q")?.trim();
  const role = param(params, "role");
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const where = and(
    like ? or(ilike(appUser.name, like), ilike(appUser.email, like)) : undefined,
    role ? sql`${appUser.role}::text = ${role}` : undefined,
  );

  const { rows, total } = await readScoped(actor, async (tx) => {
    const rows = await tx
      .select({
        id: appUser.id,
        name: appUser.name,
        email: appUser.email,
        role: appUser.role,
        status: appUser.status,
        officeName: office.name,
      })
      .from(appUser)
      .leftJoin(office, eq(appUser.officeId, office.id))
      .where(where)
      .orderBy(asc(appUser.name))
      .limit(pageSize)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(appUser).where(where);
    return { rows, total };
  });

  const showOffice = !actor.officeId;
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Accounts"
        description={showOffice ? "Everyone across all offices." : `People in ${actor.officeName}.`}
        actions={
          actor.permissions.includes("user.create") ? (
            <Button asChild>
              <Link href="/accounts/new">
                <Plus aria-hidden />
                New account
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch placeholder="Search name or email…" />
        <TableFilter name="role" label="Role" options={showOffice ? ROLES : ROLES.slice(1)} />
      </div>
      {total === 0 ? (
        <EmptyState icon={Users} title="No accounts match" description="Try a different search or filter." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {showOffice && <TableHead>Office</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/accounts/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell className="capitalize">{row.role}</TableCell>
                  {showOffice && <TableCell>{row.officeName ?? "All offices"}</TableCell>}
                  <TableCell>
                    <Badge variant={row.status === "active" ? "secondary" : "outline"}>{STATUS[row.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <RowLink href={`/accounts/${row.id}`} icon={Eye} label="View" />
                      {actor.permissions.includes("user.manage") && row.id !== actor.id && (row.role === "user" || actor.role === "developer") && (
                        <>
                          <EditAccountButton id={row.id} name={row.name} email={row.email} size="sm" />
                          <AccountStatusButton id={row.id} name={row.name} active={row.status !== "deactivated"} size="sm" />
                        </>
                      )}
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

export default function AccountsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
