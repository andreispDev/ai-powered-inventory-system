import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { AlertTriangle, Banknote, Boxes, Building2, FolderTree, PackageX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DonutChart } from "@/components/charts/donut-chart";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, PageSkeleton, StatCard } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countCategories } from "@/modules/categories/queries";
import { inventoryBreakdown, inventoryStats, listOutOfStock } from "@/modules/inventory/queries";
import { ITEM_STATUSES } from "@/modules/inventory/schemas";
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

async function Content() {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);

  const data = await readScoped(actor, async (tx) => {
    const stats = await inventoryStats(tx);
    const outOfStock = await listOutOfStock(tx);
    const breakdown = await inventoryBreakdown(tx);
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
    return { stats, outOfStock, breakdown, categories, people: people.total, offices: offices.total, activity, showActivity };
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
        {actor.role === "developer" && <StatCard label="Active offices" icon={Building2} value={data.offices.toLocaleString()} href="/console/offices" />}
        <StatCard label="Items" icon={Boxes} value={data.stats.items.toLocaleString()} href="/inventory" />
        <StatCard label="Out of stock" icon={PackageX} value={data.stats.outOfStock.toLocaleString()} href="/inventory" />
        {actor.role !== "developer" && <StatCard label="Categories" icon={FolderTree} value={data.categories.toLocaleString()} href="/categories" />}
        {can("user.read") && <StatCard label="People" icon={Users} value={data.people.toLocaleString()} href="/accounts" />}
        {actor.role === "admin" && <StatCard label="Stock value" icon={Banknote} value={value.toLocaleString(undefined, { maximumFractionDigits: 2 })} />}
      </div>

      {data.categories === 0 && data.stats.items === 0 && actor.role !== "developer" && (
        <EmptyState icon={FolderTree} title="Start by creating a category" description="Categories hold your items and let you add the columns your office needs." />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Items by status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              totalLabel="Items"
              empty="No items yet."
              slices={data.breakdown.byStatus.map((row) => ({
                label: ITEM_STATUSES.find((status) => status.value === row.label)?.label ?? row.label,
                value: row.value,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{actor.role === "developer" ? "Items by office" : "Items by category"}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              totalLabel="Items"
              empty="No items yet."
              slices={actor.role === "developer" ? data.breakdown.byOffice : data.breakdown.byCategory}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock availability</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              totalLabel="Items"
              empty="No items yet."
              slices={[
                { label: "In stock", value: data.stats.items - data.stats.outOfStock },
                { label: "Out of stock", value: data.stats.outOfStock },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning size-4" aria-hidden />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.outOfStock.length === 0 ? (
              <p className="text-muted-foreground text-sm">Everything is in stock.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.outOfStock.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 py-2">
                    <Link href={`/inventory/${row.id}`} className="truncate hover:underline">
                      {row.name}
                    </Link>
                    <span className="text-warning shrink-0">Out of stock</span>
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
