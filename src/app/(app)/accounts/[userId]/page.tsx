import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountStatusButton } from "@/modules/accounts/status-button";
import { requireActor } from "@/server/auth/session";
import { effectivePermissions, type Role } from "@/server/authz/catalog";
import { appUser, auditLog, office, permissionGrant } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Account" };

type Props = { params: Promise<{ userId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("user.read")) return <AccessDenied />;
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    // RLS hides people in other offices, so they look like records that don't exist.
    const [row] = await tx
      .select({ user: appUser, officeName: office.name })
      .from(appUser)
      .leftJoin(office, eq(appUser.officeId, office.id))
      .where(eq(appUser.id, userId));
    if (!row) return null;
    const grants = await tx.select().from(permissionGrant);
    const relevant = grants.filter((g) => g.subjectId === userId || g.subjectId === row.user.officeId);
    const activity = await tx
      .select({ id: auditLog.id, action: auditLog.action, at: auditLog.at })
      .from(auditLog)
      .where(eq(auditLog.actorId, userId))
      .orderBy(desc(auditLog.at))
      .limit(15);
    return { ...row, relevant, activity };
  });
  if (!data) notFound();

  const { user } = data;
  const permissions = effectivePermissions(user.role as Role, data.relevant);
  const canChange =
    actor.permissions.includes("user.manage") && user.id !== actor.id && (user.role === "user" || actor.role === "developer");
  const rows = [
    ["Email", user.email],
    ["Role", user.role[0].toUpperCase() + user.role.slice(1)],
    ["Office", data.officeName ?? "All offices"],
    ["Status", user.status[0].toUpperCase() + user.status.slice(1)],
  ];

  return (
    <PageContainer>
      <PageHeader
        title={user.name}
        actions={canChange ? <AccountStatusButton id={user.id} name={user.name} active={user.status !== "deactivated"} /> : undefined}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Permissions</dt>
                <dd className="font-medium tabular-nums">{permissions.length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent actions</CardTitle>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No actions yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.activity.map((entry) => (
                  <li key={entry.id.toString()} className="flex justify-between gap-3 py-2">
                    <span className="truncate font-mono text-xs">{entry.action}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      <LocalTime date={entry.at} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function AccountPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
