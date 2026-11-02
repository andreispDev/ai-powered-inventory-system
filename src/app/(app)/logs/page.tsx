import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { TableFilter, TablePagination, TableSearch } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { LogTable } from "@/modules/audit/log-table";
import { requireActor } from "@/server/auth/session";
import { appUser, auditLog, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Logs" };

type Props = { searchParams: Promise<SearchParams> };

// Logs only grow, so people need to be able to page well past the usual limit.
const MAX_LOG_OFFSET = 1_000_000;

const ACTION_GROUPS = [
  { value: "item.", label: "Items" },
  { value: "stock.", label: "Stock" },
  { value: "category", label: "Categories" },
  { value: "transfer.", label: "Transfers" },
  { value: "assignment.", label: "Assignments" },
  { value: "user.", label: "Accounts" },
  { value: "office.", label: "Offices" },
  { value: "permission.", label: "Permissions" },
  { value: "announcement.", label: "Announcements" },
  { value: "auth.", label: "Sign-ins" },
  { value: "platform.", label: "Developer views" },
];

const validDay = (value: string | undefined) => (value && z.iso.date().safeParse(value).success ? value : undefined);

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("audit.read.all") && !can("audit.read.office") && !can("audit.read.own")) return <AccessDenied />;

  const params = await searchParams;
  const seesOthers = can("audit.read.all") || can("audit.read.office");
  // RLS limits rows to the office. This narrows Users, and "My activity", to their own actions.
  const onlyMine = !seesOthers || param(params, "mine") === "1";
  const q = param(params, "q")?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const group = ACTION_GROUPS.find((g) => g.value === param(params, "action"))?.value;
  const from = validDay(param(params, "from"));
  const to = validDay(param(params, "to"));
  const officeFilter = can("audit.read.all") ? param(params, "office") : undefined;
  const { page, pageSize, offset } = parsePage(params, { maxOffset: MAX_LOG_OFFSET });

  const where = and(
    onlyMine ? eq(auditLog.actorId, actor.id) : undefined,
    like ? or(ilike(appUser.name, like), ilike(auditLog.action, like), ilike(auditLog.entityId, like)) : undefined,
    group ? sql`${auditLog.action} like ${`${group}%`}` : undefined,
    from ? gte(auditLog.at, new Date(`${from}T00:00:00`)) : undefined,
    to ? lte(auditLog.at, new Date(`${to}T23:59:59.999`)) : undefined,
    officeFilter && z.uuid().safeParse(officeFilter).success ? eq(auditLog.officeId, officeFilter) : undefined,
  );

  const data = await readScoped(actor, async (tx) => {
    const rows = await tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        before: auditLog.before,
        after: auditLog.after,
        ip: auditLog.ip,
        requestId: auditLog.requestId,
        at: auditLog.at,
        actorName: appUser.name,
        actorRole: auditLog.actorRole,
        officeName: office.name,
      })
      .from(auditLog)
      .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
      .leftJoin(office, eq(auditLog.officeId, office.id))
      .where(where)
      .orderBy(desc(auditLog.id))
      .limit(pageSize)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(auditLog)
      .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
      .where(where);
    const offices = can("audit.read.all") ? await tx.select({ value: office.id, label: office.name }).from(office) : [];
    return { rows, offices, total };
  });

  return (
    <PageContainer width="wide">
      <PageHeader
        title={onlyMine ? "My activity" : "Logs"}
        description="Every entry is permanent. Nobody can edit or delete it, and changes to the log are detected."
      />
      <div className="flex flex-wrap items-center gap-2">
        {seesOthers && <TableSearch placeholder="Search person, action or record…" />}
        <TableFilter name="action" label="Type" options={ACTION_GROUPS} />
        {data.offices.length > 0 && <TableFilter name="office" label="Office" options={data.offices} />}
      </div>
      {data.total === 0 ? (
        <EmptyState icon={ScrollText} title="No entries match" description="Try clearing a filter." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <LogTable
            showOffice={can("audit.read.all")}
            rows={data.rows.map((row) => ({ ...row, id: row.id.toString(), at: row.at.toISOString() }))}
          />
          <TablePagination total={data.total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function LogsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
