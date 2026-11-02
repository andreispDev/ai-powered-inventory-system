import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeftRight, FileText, History, TrendingUp, UserCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { TablePagination } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { listFields } from "@/modules/categories/queries";
import { formatForecastDay } from "@/modules/forecast/engine";
import { ForecastBadge, StockoutDate } from "@/modules/forecast/forecast-parts";
import { getItemForecast } from "@/modules/forecast/queries";
import { AssignDialog, ReturnButton, TransferDialog } from "@/modules/custody/custody-actions";
import { listItemAssignments } from "@/modules/custody/queries";
import { Attachments } from "@/modules/inventory/attachments";
import { DeleteItemButton, MoveStockDialog, RestoreItemButton } from "@/modules/inventory/item-actions";
import { formatAttribute, statusLabel } from "@/modules/inventory/format";
import { countMovements, getItem, listAttachments, listMovements, listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { writeAudit } from "@/server/audit/writer";
import { appUser, auditLog } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Item" };

type Props = { params: Promise<{ itemId: string }>; searchParams: Promise<SearchParams> };

function Detail({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b py-2 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate text-right font-medium">{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function Content({ params, searchParams }: Props) {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("item.read")) return <AccessDenied />;
  const { itemId } = await params;
  if (!z.uuid().safeParse(itemId).success) notFound();

  const { page, pageSize, offset } = parsePage(await searchParams);

  const data = await readScoped(actor, async (tx) => {
    const row = await getItem(tx, itemId);
    if (!row) return null;
    const fields = await listFields(tx, row.item.categoryId, true);
    const movements = await listMovements(tx, itemId, pageSize, offset);
    const movementCount = await countMovements(tx, itemId);
    const people = await listPeople(tx);
    const assignments = await listItemAssignments(tx, itemId);
    const attachments = row.kind === "records" ? await listAttachments(tx, itemId) : [];
    const prediction = can("ai.forecast.read") ? await getItemForecast(tx, itemId) : null;
    const offices = can("transfer.create")
      ? ((await tx.execute(sql`select id, name from office_directory()`)) as unknown as { rows: { id: string; name: string }[] }).rows
      : [];
    // A Developer looking at office data is itself on the record.
    if (actor.role === "developer") {
      await writeAudit(tx, { actor, action: "platform.viewed", entityType: "item", entityId: itemId, officeId: row.item.officeId });
    }
    // Users see only their own actions here, and admins and Developers see everything.
    const seesAll = can("audit.read.office") || can("audit.read.all");
    const activity = await tx
      .select({ id: auditLog.id, action: auditLog.action, at: auditLog.at, name: appUser.name })
      .from(auditLog)
      .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
      .where(and(sql`${auditLog.entityType} = 'item'`, eq(auditLog.entityId, itemId), seesAll ? undefined : eq(auditLog.actorId, actor.id)))
      .orderBy(desc(auditLog.at))
      .limit(30);
    return { ...row, fields, movements, movementCount, people, activity, assignments, offices, prediction, attachments };
  });
  if (!data) notFound();

  const { item } = data;
  const deleted = !!item.deletedAt;
  const peopleById = Object.fromEntries(data.people.map((person) => [person.id, person.name]));
  const activeFields = data.fields.filter((field) => !field.retiredAt);
  const out = item.quantity === 0;
  const isOff = (field: string) => data.disabledFields.includes(field);
  const records = data.kind === "records";

  return (
    <PageContainer>
      <PageHeader
        title={item.name}
        description={`${data.categoryName}${actor.officeId ? "" : ` · ${data.officeName}`}${deleted ? " · Deleted" : ""}`}
        actions={
          deleted ? (
            can("item.restore") ? <RestoreItemButton id={item.id} /> : undefined
          ) : (
            <>
              {!records && can("stock.move") && <MoveStockDialog itemId={item.id} unit={item.unit} quantity={item.quantity} />}
              {!records && can("assignment.manage") && <AssignDialog itemId={item.id} people={data.people} />}
              {!records && can("transfer.create") && (
                <TransferDialog
                  itemId={item.id}
                  unit={item.unit}
                  quantity={item.quantity}
                  offices={data.offices.filter((office) => office.id !== item.officeId)}
                />
              )}
              {can("item.update") && (
                <Button variant="outline" asChild>
                  <Link href={`/${records ? "records" : "inventory"}/${item.id}/edit`}>Edit</Link>
                </Button>
              )}
              {can("item.delete") && <DeleteItemButton id={item.id} name={item.name} records={records} />}
            </>
          )
        }
      />

      {data.prediction && !deleted && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle icon={TrendingUp}>Prediction</CardTitle>
            <ForecastBadge state={data.prediction.state} confidence={data.prediction.confidence} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{data.prediction.reason}</p>
            {data.prediction.stockoutAt && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Runs out</p>
                  <StockoutDate day={data.prediction.stockoutAt} earliest={data.prediction.stockoutEarliest} latest={data.prediction.stockoutLatest} />
                </div>
                {data.prediction.reorderQuantity && data.prediction.reorderBy && (
                  <div>
                    <p className="text-muted-foreground">Suggestion</p>
                    <span className="font-medium">
                      Order {data.prediction.reorderQuantity} {item.unit} by {formatForecastDay(data.prediction.reorderBy)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <p className="text-muted-foreground text-xs">This is advice only. Nothing changes automatically.</p>
          </CardContent>
        </Card>
      )}

      {!records && (
      <div className={`grid gap-4 ${isOff("location") ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Card>
          <CardHeader>
            <p className="text-muted-foreground text-sm">In stock</p>
            <CardTitle className={`text-3xl tabular-nums ${out ? "text-warning" : ""}`}>
              {item.quantity.toLocaleString()} <span className="text-base font-normal">{item.unit}</span>
            </CardTitle>
            {out && <p className="text-warning text-xs">Out of stock</p>}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-muted-foreground text-sm">Status</p>
            <div>
              <Badge variant={item.status === "active" ? "secondary" : "outline"}>{statusLabel(item.status)}</Badge>
            </div>
          </CardHeader>
        </Card>
        {!isOff("location") && (
          <Card>
            <CardHeader>
              <p className="text-muted-foreground text-sm">Location</p>
              <CardTitle>{item.location ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={FileText}>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Detail
            rows={records ? [
              ["Reference", item.sku],
              ...(isOff("location") ? [] : ([["Location", item.location]] as [string, string | null][])),
              ...activeFields.map(
                (field): [string, string] => [field.label, formatAttribute(item.attributes[field.key], field, peopleById)],
              ),
            ] : [
              ["SKU", item.sku],
              ["Serial number", item.serialNumber],
              ["Condition", item.condition],
              ...(isOff("supplier") ? [] : ([["Supplier", item.supplier]] as [string, string | null][])),
              ...(isOff("unitCost") ? [] : ([["Unit cost", item.unitCost]] as [string, string | null][])),
              ...(isOff("purchaseDate") ? [] : ([["Purchase date", item.purchaseDate]] as [string, string | null][])),
              ["Warranty expiry", item.warrantyExpiry],
              ...activeFields.map(
                (field): [string, string] => [field.label, formatAttribute(item.attributes[field.key], field, peopleById)],
              ),
            ]}
          />
          {item.notes && <p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
        </CardContent>
      </Card>

      {records && <Attachments itemId={item.id} files={data.attachments} canEdit={can("item.update") && !deleted} />}

      {!records && (
      <>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle icon={UserCheck}>Custody</CardTitle>
        </CardHeader>
        <CardContent>
          {data.assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not assigned to anyone.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.assignments.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{entry.assigneeName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      since {entry.since}, by {entry.assignedByName}
                      {entry.dueAt ? ` · due ${entry.dueAt}` : ""}
                    </span>
                  </span>
                  {entry.returnedAt ? (
                    <Badge variant="outline">Returned</Badge>
                  ) : (
                    can("assignment.manage") && <ReturnButton id={entry.id} name={entry.assigneeName} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle icon={ArrowLeftRight}>Stock history</CardTitle>
        </CardHeader>
        <CardContent>
          {data.movementCount === 0 ? (
            <p className="text-muted-foreground text-sm">No movements yet.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  {can("user.read") && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.map((movement) => (
                  <TableRow key={movement.id.toString()}>
                    <TableCell>
                      <LocalTime date={movement.occurredAt} />
                    </TableCell>
                    <TableCell className="capitalize">{movement.type.replace("_", " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movement.delta > 0 ? "+" : ""}
                      {movement.delta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{movement.balanceAfter}</TableCell>
                    <TableCell className="max-w-64 truncate">{movement.reason}</TableCell>
                    <TableCell>{movement.actorName ?? "—"}</TableCell>
                    {can("user.read") && (
                      <TableCell>
                        <RowActions>
                          <RowLink href={`/accounts/${movement.actorId}`} icon={UserRound} label="View person" />
                        </RowActions>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination total={data.movementCount} page={page} pageSize={pageSize} />
            </>
          )}
        </CardContent>
      </Card>
      </>
      )}

      <Card className="gap-3">
        <CardHeader>
          <CardTitle icon={History}>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity to show.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.activity.map((entry) => (
                <li key={entry.id.toString()} className="flex justify-between gap-3 py-2">
                  <span className="truncate">
                    <span className="font-medium">{entry.name ?? "Unknown"}</span>{" "}
                    <span className="text-muted-foreground font-mono text-xs">{entry.action}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    <LocalTime date={entry.at} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function ItemPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
