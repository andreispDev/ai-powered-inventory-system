import { CalendarClock, Eye, History, PackagePlus, Snail, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TablePagination } from "@/components/data-table/pagination";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { EmptyState, PageContainer, PageHeader, StatCard, TableSkeleton } from "@/components/shell/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { formatForecastDay } from "@/modules/forecast/engine";
import { ForecastBadge, StockoutDate } from "@/modules/forecast/forecast-parts";
import { forecastAccuracy, forecastSummary, listForecasts } from "@/modules/forecast/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Predictions" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("ai.forecast.read")) return <AccessDenied />;
  const { page, pageSize, offset } = parsePage(await searchParams);
  const isDeveloper = actor.role === "developer";
  const { list, summary, accuracy } = await readScoped(actor, async (tx) => ({
    list: await listForecasts(tx, pageSize, offset),
    summary: await forecastSummary(tx),
    accuracy: isDeveloper ? await forecastAccuracy(tx) : [],
  }));

  return (
    <PageContainer width="wide">
      <PageHeader title="Predictions" description="Advice from your stock history, refreshed every night. Nothing changes automatically." />
      {list.total === 0 ? (
        <EmptyState icon={TrendingUp} title="No predictions yet" description="They appear after the background worker's next run." />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-4">
            <StatCard label="Running out in 30 days" icon={CalendarClock} value={summary.soon.toLocaleString()} />
            <StatCard label="Reorder suggested" icon={PackagePlus} value={summary.reorder.toLocaleString()} />
            <StatCard label="Slow moving" icon={Snail} value={summary.slow.toLocaleString()} />
            <StatCard label="Not enough history" icon={History} value={summary.noHistory.toLocaleString()} />
          </div>
          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  {isDeveloper && <TableHead>Office</TableHead>}
                  <TableHead>Use per week</TableHead>
                  <TableHead>Runs out</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map(({ forecast: row, itemName, unit, officeName }) => (
                  <TableRow key={row.itemId}>
                    <TableCell className="max-w-96 whitespace-normal">
                      <Link href={`/inventory/${row.itemId}`} className="font-medium hover:underline">
                        {itemName}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{row.reason}</span>
                    </TableCell>
                    {isDeveloper && <TableCell>{officeName}</TableCell>}
                    <TableCell>
                      {row.weeklyDemand === null ? (
                        "—"
                      ) : (
                        <>
                          <span className="font-medium">
                            {row.weeklyDemand} {unit}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {row.weeklyLow} to {row.weeklyHigh}
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <StockoutDate day={row.stockoutAt} earliest={row.stockoutEarliest} latest={row.stockoutLatest} />
                    </TableCell>
                    <TableCell>
                      {row.reorderQuantity && row.reorderBy ? (
                        <>
                          <span className="font-medium">
                            Order {row.reorderQuantity} {unit}
                          </span>
                          <span className="text-muted-foreground block text-xs">By {formatForecastDay(row.reorderBy)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ForecastBadge state={row.state} confidence={row.confidence} />
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <RowLink href={`/inventory/${row.itemId}`} icon={Eye} label="View item" />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination total={list.total} page={page} pageSize={pageSize} />
          </Card>
          {summary.updatedAt && (
            <p className="text-muted-foreground text-xs">
              Last updated <LocalTime date={summary.updatedAt} />
            </p>
          )}
          {isDeveloper && accuracy.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast accuracy by office</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Office</TableHead>
                      <TableHead>Items forecast</TableHead>
                      <TableHead>Average weekly error</TableHead>
                      <TableHead>Simple baseline error</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accuracy.map((row) => (
                      <TableRow key={row.officeId}>
                        <TableCell className="font-medium">{row.officeName}</TableCell>
                        <TableCell>{row.items}</TableCell>
                        <TableCell>{row.error}</TableCell>
                        <TableCell>{row.baseline}</TableCell>
                        <TableCell>
                          <RowActions>
                            <RowLink href={`/console/offices/${row.officeId}`} icon={Eye} label="View office" />
                          </RowActions>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default function PredictionsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
