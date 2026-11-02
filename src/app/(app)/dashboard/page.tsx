import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { AlertTriangle, Boxes, FolderTree } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countCategories } from "@/modules/categories/queries";
import { inventoryStats, listLowStock } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { appUser, auditLog, office } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_LABELS: Record<string, string> = {
  "item.created": "added an item",
  "item.updated": "edited an item",
  "item.deleted": "deleted an item",
  "item.restored": "restored an item",
  "stock.receive": "received stock",
  "stock.issue": "issued stock",
  "stock.return": "returned stock",
  "stock.adjust": "adjusted stock",
  "category.created": "created a category",
  "user.created": "created an account",
  "office.created": "created an office",
};

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <Card
      className={
        href
          ? "surface-soft hover:shadow-raised h-full transition-shadow duration-[var(--motion-base)]"
          : "surface-soft h-full"
      }
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

async function Content() {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);

  const data = await readScoped(actor, async (tx) => {
    const stats = await inventoryStats(tx);
    const lowStock = await listLowStock(tx);
    const categories = await countCategories(tx);
    const [people] = await tx.select({ total: count() }).from(appUser).where(sql`${appUser.status} <> 'deactivated'`);
    const [offices] = await tx.select({ total: count() }).from(office).where(eq(office.status, "active"));
    const showActivity = can("audit.read.all") || can("audit.read.office");
    const activity = showActivity
      ? await tx
          .select({ id: auditLog.id, action: auditLog.action, at: auditLog.at, name: appUser.name })
          .from(auditLog)
          .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
          .where(sql`${auditLog.action} not like 'auth.%' and ${isNull(appUser.id)} is false`)
          .orderBy(desc(auditLog.at))
          .limit(8)
      : [];
    return { stats, lowStock, categories, people: people.total, offices: offices.total, activity, showActivity };
  });

  const value = Number(data.stats.value);
  const description =
    actor.role === "developer"
      ? "Overview across all offices."
      : actor.role === "admin"
        ? `${actor.officeName} at a glance.`
        : "What needs your attention today.";

  return (
    <PageContainer>
      <PageHeader title={`Welcome, ${actor.name.split(" ")[0]}`} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actor.role === "developer" && <Stat label="Active offices" value={data.offices.toLocaleString()} href="/console/offices" />}
        <Stat label="Items" value={data.stats.items.toLocaleString()} href="/inventory" />
        <Stat label="Low stock" value={data.stats.lowStock.toLocaleString()} href="/inventory" />
        {actor.role !== "developer" && <Stat label="Categories" value={data.categories.toLocaleString()} href="/categories" />}
        {can("user.read") && <Stat label="People" value={data.people.toLocaleString()} href="/accounts" />}
        {actor.role === "admin" && <Stat label="Stock value" value={value.toLocaleString(undefined, { maximumFractionDigits: 2 })} />}
      </div>

      {data.categories === 0 && data.stats.items === 0 && actor.role !== "developer" && (
        <EmptyState icon={FolderTree} title="Start by creating a category" description="Categories hold your items and let you add the columns your office needs." />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning size-4" aria-hidden />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing is at or below its reorder level.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.lowStock.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 py-2">
                    <Link href={`/inventory/${row.id}`} className="truncate hover:underline">
                      {row.name}
                    </Link>
                    <span className="text-warning shrink-0 tabular-nums">
                      {row.quantity} {row.unit} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {data.showActivity && (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.activity.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.activity.map((row) => (
                    <li key={row.id.toString()} className="flex justify-between gap-3 py-2">
                      <span className="truncate">
                        <span className="font-medium">{row.name}</span> {ACTION_LABELS[row.action] ?? row.action}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        <LocalTime date={row.at} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {!data.showActivity && can("item.create") && (
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/inventory/new">
                  <Boxes aria-hidden />
                  Add item
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/categories/new">New category</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
