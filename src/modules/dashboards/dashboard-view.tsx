import { Boxes, Building2, ShieldCheck } from "lucide-react";
import { EmptyState, PageContainer, PageHeader } from "@/components/shell/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/server/authz/catalog";

const INTRO: Record<Role, { description: string; emptyTitle: string; emptyText: string; icon: typeof Boxes }> = {
  developer: {
    description: "Platform overview across all offices.",
    emptyTitle: "No offices to show yet",
    emptyText: "Office management and system health arrive in the next build phases.",
    icon: Building2,
  },
  admin: {
    description: "Your office at a glance.",
    emptyTitle: "No office activity yet",
    emptyText: "Stock figures and staff activity will appear here once inventory is built.",
    icon: ShieldCheck,
  },
  user: {
    description: "Your work and what needs attention.",
    emptyTitle: "No inventory yet",
    emptyText: "You'll be able to create categories and add items once inventory is built.",
    icon: Boxes,
  },
};

export function DashboardView({
  name,
  role,
  officeName,
  permissionCount,
}: {
  name: string;
  role: Role;
  officeName: string | null;
  permissionCount: number;
}) {
  const intro = INTRO[role];
  return (
    <PageContainer>
      <PageHeader title={`Welcome, ${name.split(" ")[0]}`} description={intro.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Scope</CardDescription>
            <CardTitle>{officeName ?? "All offices"}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {officeName ? "You can only see this office's data." : "You can view every office."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Your permissions</CardDescription>
            <CardTitle className="tabular-nums">{permissionCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Set by your role and any access granted to you.
          </CardContent>
        </Card>
      </div>
      <EmptyState icon={intro.icon} title={intro.emptyTitle} description={intro.emptyText} />
    </PageContainer>
  );
}
