import { count, desc } from "drizzle-orm";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TablePagination } from "@/components/data-table/pagination";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { requireActor } from "@/server/auth/session";
import { notification } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Notifications" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  const { page, pageSize, offset } = parsePage(await searchParams);
  const { rows, total } = await readScoped(actor, async (tx) => {
    const rows = await tx.select().from(notification).orderBy(desc(notification.createdAt)).limit(pageSize).offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(notification);
    return { rows, total };
  });
  return (
    <PageContainer>
      <PageHeader title="Notifications" description="Announcements and things that need your attention." />
      {total === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="New notifications will appear here." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y">
            {rows.map((note) => (
              <li key={note.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${note.readAt ? "" : "bg-primary/10"}`}>
                <div className="flex min-w-0 gap-2.5">
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${note.readAt ? "" : "bg-primary"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm ${note.readAt ? "" : "font-medium"}`}>
                      {!note.readAt && <span className="sr-only">Unread: </span>}
                      {note.link ? (
                        <Link href={note.link} className="hover:underline">
                          {note.title}
                        </Link>
                      ) : (
                        note.title
                      )}
                    </p>
                    {note.body && <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-wrap">{note.body}</p>}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  <LocalTime date={note.createdAt} />
                </span>
              </li>
            ))}
          </ul>
          <TablePagination total={total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function NotificationsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton width="default" />}>
      <Content {...props} />
    </Suspense>
  );
}
