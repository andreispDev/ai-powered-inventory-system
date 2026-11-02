import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ShellSkeleton } from "@/components/shell/page";
import { requireActor } from "@/server/auth/session";

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  return (
    <AppShell
      user={{
        name: actor.name,
        email: actor.email,
        image: actor.image,
        role: actor.role,
        officeName: actor.officeName,
        workspaceName: actor.workspaceName,
        logoUrl: actor.logoUrl,
        idleMinutes: actor.idleMinutes,
        permissions: actor.permissions,
        preferences: actor.preferences,
      }}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
