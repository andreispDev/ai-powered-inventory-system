import { ArrowLeftRight, Boxes, Building2, CalendarDays, CircleDot, FolderTree, History, KeyRound, type LucideIcon, Mail, Megaphone, PackageCheck, Shield, UserCheck, UserRound } from "lucide-react";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import type { ReactNode } from "react";
import { LocalTime } from "@/components/shell/local-time";
import { StatCard } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assignment, auditLog } from "@/server/db/schema";
import type { ScopedTx } from "@/server/db/scope";

const ACTIVITY: { prefix: string; icon: LucideIcon; label: string }[] = [
  { prefix: "item.created", icon: Boxes, label: "Added an item" },
  { prefix: "item.updated", icon: Boxes, label: "Edited an item" },
  { prefix: "item.deleted", icon: Boxes, label: "Deleted an item" },
  { prefix: "item.restored", icon: Boxes, label: "Restored an item" },
  { prefix: "stock.", icon: PackageCheck, label: "Moved stock" },
  { prefix: "category", icon: FolderTree, label: "Changed a category" },
  { prefix: "transfer.", icon: ArrowLeftRight, label: "Worked on a transfer" },
  { prefix: "assignment.", icon: UserCheck, label: "Worked on an assignment" },
  { prefix: "permission.", icon: KeyRound, label: "Changed access" },
  { prefix: "announcement.", icon: Megaphone, label: "Sent an announcement" },
  { prefix: "office.", icon: Building2, label: "Changed an office" },
  { prefix: "workspace.", icon: Building2, label: "Changed the workspace" },
  { prefix: "user.", icon: UserRound, label: "Changed an account" },
];

const describe = (action: string) => ACTIVITY.find((entry) => action.startsWith(entry.prefix)) ?? { icon: History, label: action };

/** Everything the profile shows beyond the account itself. RLS limits it to what the viewer may see. */
export async function loadProfileActivity(tx: ScopedTx, userId: string) {
  const recent = await tx
    .select({ id: auditLog.id, action: auditLog.action, at: auditLog.at })
    .from(auditLog)
    .where(eq(auditLog.actorId, userId))
    .orderBy(desc(auditLog.at))
    .limit(10);
  const [{ actions }] = await tx
    .select({ actions: count() })
    .from(auditLog)
    .where(and(eq(auditLog.actorId, userId), gte(auditLog.at, new Date(Date.now() - 30 * 86_400_000))));
  const [{ holding }] = await tx
    .select({ holding: count() })
    .from(assignment)
    .where(and(eq(assignment.assigneeId, userId), isNull(assignment.returnedAt)));
  return { recent, actions, holding };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const title = (text: string) => text[0].toUpperCase() + text.slice(1);

export function ProfilePhoto({ name, url, picked }: { name: string; url: string | null; picked?: string | null }) {
  const source = picked ?? url;
  return (
    <span className="bg-primary text-primary-foreground ring-card shadow-raised flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full text-3xl font-semibold ring-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {source ? <img src={source} alt={`${name}'s photo`} className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

export function ProfileView({
  name,
  email,
  role,
  status,
  officeName,
  memberSince,
  permissionCount,
  photo,
  actions,
  activity,
}: {
  name: string;
  email: string;
  role: string;
  status: string;
  officeName: string | null;
  memberSince: Date;
  permissionCount: number;
  photo: ReactNode;
  actions?: ReactNode;
  activity: Awaited<ReturnType<typeof loadProfileActivity>>;
}) {
  const details: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    { icon: Mail, label: "Email", value: email },
    { icon: Shield, label: "Role", value: title(role) },
    { icon: Building2, label: "Office", value: officeName ?? "All offices" },
    { icon: CircleDot, label: "Status", value: title(status) },
    { icon: CalendarDays, label: "Member since", value: <LocalTime date={memberSince} /> },
  ];

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <div aria-hidden className="welcome-banner relative isolate h-28">
          <div className="welcome-rings absolute inset-0 -z-10" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="relative z-10 -mt-12 min-w-0 space-y-3">
            {photo}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge>{title(role)}</Badge>
                <Badge variant={status === "active" ? "secondary" : "outline"}>{title(status)}</Badge>
                <span className="text-muted-foreground text-sm">{officeName ?? "All offices"}</span>
              </div>
            </div>
          </div>
          {actions}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Actions in 30 days" icon={History} value={activity.actions.toLocaleString()} />
        <StatCard label="Items held" icon={UserCheck} value={activity.holding.toLocaleString()} />
        <StatCard label="Permissions" icon={KeyRound} value={permissionCount.toLocaleString()} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle icon={UserRound}>About</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-center gap-3 py-2.5">
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <detail.icon className="size-4" aria-hidden />
                  </span>
                  <dt className="text-muted-foreground">{detail.label}</dt>
                  <dd className="ml-auto min-w-0 truncate text-right font-medium">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle icon={History}>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {activity.recent.map((entry) => {
                  const { icon: Icon, label } = describe(entry.action);
                  return (
                    <li key={entry.id.toString()} className="flex items-center gap-3">
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        <LocalTime date={entry.at} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
