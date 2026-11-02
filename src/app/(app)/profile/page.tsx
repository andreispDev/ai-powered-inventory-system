import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { requireActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile" };

async function Content() {
  const actor = await requireActor();
  const rows = [
    ["Name", actor.name],
    ["Email", actor.email],
    ["Role", actor.role[0].toUpperCase() + actor.role.slice(1)],
    ["Office", actor.officeName ?? "All offices"],
  ];
  return (
    <PageContainer width="narrow">
      <PageHeader title="Profile" description="Your account details." />
      <Card>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
