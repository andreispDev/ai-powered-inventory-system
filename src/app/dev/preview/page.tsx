import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageSkeleton } from "@/components/shell/page";
import { DashboardView } from "@/modules/dashboards/dashboard-view";
import { effectivePermissions, type Role } from "@/server/authz/catalog";

// Development only: shows the shell per role with sample names and no real data or session.
async function Preview({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await connection();
  const { role: requested } = await searchParams;
  const role: Role = requested === "developer" || requested === "admin" ? requested : "user";
  const officeName = role === "developer" ? null : "Sample Office";
  const permissions = effectivePermissions(role, []);

  return (
    <AppShell
      user={{ name: `Sample ${role}`, email: `${role}@example.test`, image: null, role, officeName, permissions }}
    >
      <DashboardView
        name={`Sample ${role}`}
        role={role}
        officeName={officeName}
        permissionCount={permissions.length}
      />
    </AppShell>
  );
}

export default function PreviewPage(props: { searchParams: Promise<{ role?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Preview {...props} />
    </Suspense>
  );
}
