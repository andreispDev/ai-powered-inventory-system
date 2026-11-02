import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { OfficeForm } from "@/modules/offices/office-form";
import { requireActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "New office" };

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("office.manage")) return <AccessDenied />;
  return (
    <PageContainer width="narrow">
      <PageHeader title="New office" description="You'll add its admin on the next screen." />
      <Card>
        <CardContent>
          <OfficeForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function NewOfficePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
