import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page";
import { DashboardView } from "@/modules/dashboards/dashboard-view";
import { requireActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

async function Content() {
  const actor = await requireActor();
  return (
    <DashboardView
      name={actor.name}
      role={actor.role}
      officeName={actor.officeName}
      permissionCount={actor.permissions.length}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
