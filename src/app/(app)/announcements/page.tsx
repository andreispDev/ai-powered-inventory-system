import { count, desc, eq, sql } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { TablePagination } from "@/components/data-table/pagination";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementForm } from "@/modules/notifications/announcement-form";
import { requireActor } from "@/server/auth/session";
import { announcement, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Announcements" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  const global = actor.permissions.includes("announce.all");
  if (!global && !actor.permissions.includes("announce.office")) return <AccessDenied />;
  const { page, pageSize, offset } = parsePage(await searchParams);

  const data = await readScoped(actor, async (tx) => {
    const rows = await tx.select().from(announcement).orderBy(desc(announcement.createdAt)).limit(pageSize).offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(announcement);
    const withCounts = [];
    for (const row of rows) {
      const result = (await tx.execute(sql`select total::int, read::int from announcement_read_counts(${row.id}::uuid)`)) as unknown as {
        rows: { total: number; read: number }[];
      };
      withCounts.push({ ...row, ...result.rows[0] });
    }
    const offices = global ? await tx.select({ id: office.id, name: office.name }).from(office).where(eq(office.status, "active")) : [];
    return { rows: withCounts, offices, total };
  });

  return (
    <PageContainer>
      <PageHeader title="Announcements" description={global ? "Send a message to everyone, chosen offices or a role." : `Send a message to ${actor.officeName}.`} />
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle icon={Megaphone}>New announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementForm global={global} offices={data.offices} officeName={actor.officeName} />
          </CardContent>
        </Card>
        {data.total === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" description="Sent announcements appear here with how many people read them." />
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y">
              {data.rows.map((row) => (
                <li key={row.id} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{row.title}</p>
                    {row.urgent && <Badge variant="outline">Urgent</Badge>}
                    {!row.sentAt && <Badge variant="secondary">{row.scheduledAt ? "Scheduled" : "Sending"}</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">{row.body}</p>
                  <p className="text-muted-foreground text-xs">
                    <LocalTime date={row.sentAt ?? row.scheduledAt ?? row.createdAt} />
                    {row.sentAt ? ` · read by ${row.read} of ${row.total}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <TablePagination total={data.total} page={page} pageSize={pageSize} />
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

export default function AnnouncementsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton width="default" />}>
      <Content {...props} />
    </Suspense>
  );
}
