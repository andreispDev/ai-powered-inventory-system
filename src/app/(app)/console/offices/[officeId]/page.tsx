import { Building2, UserPlus, Users } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "@/modules/accounts/account-form";
import { ArchiveOfficeButton } from "@/modules/offices/archive-button";
import { OfficeForm } from "@/modules/offices/office-form";
import { requireActor } from "@/server/auth/session";
import { writeAudit } from "@/server/audit/writer";
import { appUser, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Office" };

type Props = { params: Promise<{ officeId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("office.manage")) return <AccessDenied />;
  const { officeId } = await params;
  if (!z.uuid().safeParse(officeId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    const [row] = await tx.select().from(office).where(eq(office.id, officeId));
    if (row) await writeAudit(tx, { actor, action: "platform.viewed", entityType: "office", entityId: officeId, officeId });
    const people = await tx
      .select({ id: appUser.id, name: appUser.name, email: appUser.email, role: appUser.role, status: appUser.status })
      .from(appUser)
      .where(eq(appUser.officeId, officeId))
      .orderBy(asc(appUser.role), asc(appUser.name))
      .limit(100);
    return { row, people };
  });
  if (!data.row) notFound();
  const archived = data.row.status === "archived";

  return (
    <PageContainer>
      <PageHeader
        title={data.row.name}
        description={archived ? "This office is archived." : `Office code ${data.row.code}`}
        actions={<ArchiveOfficeButton id={data.row.id} archived={archived} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle icon={Building2}>Office profile</CardTitle>
          </CardHeader>
          <CardContent>
            <OfficeForm office={data.row} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle icon={Users}>People</CardTitle>
            </CardHeader>
            <CardContent>
              {data.people.length === 0 ? (
                <p className="text-muted-foreground text-sm">No one yet. Add this office&apos;s admin below.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.people.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link href={`/accounts/${person.id}`} className="block truncate font-medium hover:underline">
                          {person.name}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">{person.email}</p>
                      </div>
                      <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                        {person.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {!archived && (
            <Card>
              <CardHeader>
                <CardTitle icon={UserPlus}>Add a person</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountForm canCreateAdmin fixedOfficeId={data.row.id} defaultRole="admin" onDone="stay" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export default function OfficePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
