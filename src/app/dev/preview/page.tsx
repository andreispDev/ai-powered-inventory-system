import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
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
      user={{ name: `Sample ${role}`, email: `${role}@example.test`, image: null, role, officeName, permissions, preferences: null }}
    >
      <PageContainer>
        <PageHeader title={`Sample ${role}`} description="Preview of the navigation for this role." />
      </PageContainer>
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
