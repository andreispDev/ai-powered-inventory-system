import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { AppearanceSettings } from "@/modules/preferences/appearance-settings";
import { WorkspaceSettings } from "@/modules/preferences/workspace-settings";
import { requireActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings" };

async function Workspace() {
  const actor = await requireActor();
  if (!actor.officeId || !actor.permissions.includes("workspace.manage")) return null;
  return <WorkspaceSettings name={actor.workspaceName} logoUrl={actor.logoUrl} />;
}

export default function SettingsPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Settings" description="Your workspace and how the app looks." />
      <Suspense fallback={<PageSkeleton />}>
        <Workspace />
      </Suspense>
      <AppearanceSettings />
    </PageContainer>
  );
}
