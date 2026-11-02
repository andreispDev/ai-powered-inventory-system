import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { AccountForm } from "@/modules/accounts/account-form";
import { requireActor } from "@/server/auth/session";
import { office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "New account" };

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("user.create")) return <AccessDenied />;

  const offices = actor.officeId
    ? undefined
    : await readScoped(actor, (tx) =>
        tx
          .select({ id: office.id, name: office.name })
          .from(office)
          .where(eq(office.status, "active"))
          .orderBy(asc(office.name)),
      );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="New account"
        description={actor.officeName ? `They'll join ${actor.officeName}.` : "They can sign in once this is created."}
      />
      <Card>
        <CardContent>
          <AccountForm canCreateAdmin={actor.permissions.includes("admin.create")} offices={offices} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function NewAccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
