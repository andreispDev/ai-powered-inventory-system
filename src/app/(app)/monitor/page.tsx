import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { LiveMonitor } from "@/modules/monitoring/live-monitor";
import { requireActor } from "@/server/auth/session";
import { appUser, auditLog } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Live monitor" };

async function Content() {
  const actor = await requireActor();
  const all = actor.permissions.includes("monitor.all");
  if (!all && !actor.permissions.includes("monitor.office")) return <AccessDenied />;

  const rows = await readScoped(actor, (tx) =>
    tx
      .select({ id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId, at: auditLog.at, actorName: appUser.name })
      .from(auditLog)
      .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
      .where(sql`${auditLog.action} <> 'platform.viewed'`)
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(50),
  );

  return (
    <PageContainer width="wide">
      <PageHeader title="Live monitor" description={all ? "Activity and who's online across all offices." : `Activity and who's online in ${actor.officeName}.`} />
      <LiveMonitor
        initial={rows.map((row) => ({
          key: row.id.toString(),
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          actorName: row.actorName,
          at: row.at.toISOString(),
        }))}
      />
    </PageContainer>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content />
    </Suspense>
  );
}
