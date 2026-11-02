import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { AlertTriangle, Banknote, Boxes, Building2, FolderTree, PackageX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DonutChart } from "@/components/charts/donut-chart";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageSkeleton, StatCard } from "@/components/shell/page";
import { WelcomeBanner } from "@/components/shell/welcome-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countCategories } from "@/modules/categories/queries";
import { formatForecastDay } from "@/modules/forecast/engine";
import { ForecastBadge } from "@/modules/forecast/forecast-parts";
import { listSoonestStockouts } from "@/modules/forecast/queries";
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
  "user.photo_changed": "changed their photo",
  "user.photo_removed": "removed their photo",
  "workspace.renamed": "renamed the workspace",
  "workspace.logo_changed": "changed the workspace logo",
  "workspace.logo_removed": "removed the workspace logo",
  "transfer.requested": "started a transfer",
  "transfer.completed": "completed a transfer",
  "transfer.rejected": "rejected a transfer",
  "transfer.cancelled": "cancelled a transfer",
  "assignment.created": "assigned an item",
  "assignment.returned": "marked an item returned",
  "announcement.created": "sent an announcement",
  "permission.granted": "changed someone's access",
  "permission.cleared": "changed someone's access",
  "permission.requested": "asked for access",
  "permission.request_approved": "approved an access request",
  "permission.request_rejected": "declined an access request",
  "notification.acknowledged": "acknowledged an announcement",
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
    const stockouts = can("ai.forecast.read") ? await listSoonestStockouts(tx) : [];
    return { stats, outOfStock, breakdown, categories, people: people.total, offices: offices.total, activity, showActivity, stockouts };
  });

  const value = Number(data.stats.value);
  const waiting = data.stats.outOfStock;
  const description =
    actor.role === "developer"
      ? "Here's how every office is doing."
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "item needs" : "items need"} attention in ${actor.officeName}.`
        : `Everything is in stock at ${actor.officeName}.`;

  return (
    <PageContainer>
      <WelcomeBanner
        name={actor.name.split(" ")[0]}
        badge={actor.workspaceName ?? actor.officeName ?? "All offices"}
        subtitle={description}
        media={
          actor.logoUrl ? (
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={actor.logoUrl} alt="" className="size-full object-contain" />
            </span>
          ) : undefined
        }
        actions={[
          ...(can("item.create") ? [{ label: "Add item", href: "/inventory/new" }] : []),
          ...(can("office.manage") ? [{ label: "Offices", href: "/console/offices" }] : []),
          ...(can("monitor.office") || can("monitor.all") ? [{ label: "Live monitor", href: "/monitor" }] : []),
          { label: "My profile", href: "/profile" },
        ]}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-4">
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

      {data.stockouts.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Predicted to run out</CardTitle>
            <Link href="/predictions" className="text-muted-foreground text-sm hover:underline">
              All predictions
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.stockouts.map((row) => (
                <li key={row.itemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                  <Link href={`/inventory/${row.itemId}`} className="min-w-0 truncate hover:underline">
                    {row.name}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{formatForecastDay(row.stockoutAt!)}</span>
                    <ForecastBadge state="ready" confidence={row.confidence} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
