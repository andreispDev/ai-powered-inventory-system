import { and, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listFields } from "@/modules/categories/queries";
import { DeleteItemButton, MoveStockDialog, RestoreItemButton } from "@/modules/inventory/item-actions";
import { formatAttribute, statusLabel } from "@/modules/inventory/format";
import { getItem, listMovements, listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { appUser, auditLog } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Item" };

type Props = { params: Promise<{ itemId: string }> };

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

async function Content({ params }: Props) {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("item.read")) return <AccessDenied />;
  const { itemId } = await params;
  if (!z.uuid().safeParse(itemId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    const row = await getItem(tx, itemId);
    if (!row) return null;
    const fields = await listFields(tx, row.item.categoryId, true);
    const movements = await listMovements(tx, itemId);
    const people = fields.some((field) => field.type === "person") ? await listPeople(tx) : [];
    // Users see only their own actions here, and admins and Developers see everything.
    const seesAll = can("audit.read.office") || can("audit.read.all");
    const activity = await tx
      .select({ id: auditLog.id, action: auditLog.action, at: auditLog.at, name: appUser.name })
      .from(auditLog)
      .leftJoin(appUser, eq(auditLog.actorId, appUser.id))
      .where(and(sql`${auditLog.entityType} = 'item'`, eq(auditLog.entityId, itemId), seesAll ? undefined : eq(auditLog.actorId, actor.id)))
      .orderBy(desc(auditLog.at))
      .limit(30);
    return { ...row, fields, movements, people, activity };
  });
  if (!data) notFound();

  const { item } = data;
  const deleted = !!item.deletedAt;
  const peopleById = Object.fromEntries(data.people.map((person) => [person.id, person.name]));
  const activeFields = data.fields.filter((field) => !field.retiredAt);
  const low = item.reorderLevel !== null && item.quantity <= item.reorderLevel;

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
              {can("stock.move") && <MoveStockDialog itemId={item.id} unit={item.unit} quantity={item.quantity} />}
              {can("item.update") && (
                <Button variant="outline" asChild>
                  <Link href={`/inventory/${item.id}/edit`}>Edit</Link>
                </Button>
              )}
              {can("item.delete") && <DeleteItemButton id={item.id} name={item.name} />}
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-muted-foreground text-sm">In stock</p>
            <CardTitle className={`text-3xl tabular-nums ${low ? "text-warning" : ""}`}>
              {item.quantity.toLocaleString()} <span className="text-base font-normal">{item.unit}</span>
            </CardTitle>
            {low && <p className="text-warning text-xs">At or below reorder level ({item.reorderLevel})</p>}
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
        <Card>
          <CardHeader>
            <p className="text-muted-foreground text-sm">Location</p>
            <CardTitle>{item.location ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Detail
            rows={[
              ["SKU", item.sku],
              ["Serial number", item.serialNumber],
              ["Condition", item.condition],
              ["Supplier", item.supplier],
              ["Unit cost", item.unitCost],
              ["Reorder level", item.reorderLevel],
              ["Purchase date", item.purchaseDate],
              ["Warranty expiry", item.warrantyExpiry],
              ...activeFields.map(
                (field): [string, string] => [field.label, formatAttribute(item.attributes[field.key], field, peopleById)],
              ),
            ]}
          />
          {item.notes && <p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Stock history</CardTitle>
        </CardHeader>
        <CardContent>
          {data.movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">No movements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.map((movement) => (
                  <TableRow key={movement.id.toString()}>
                    <TableCell>
                      <LocalTime date={movement.occurredAt} />
                    </TableCell>
                    <TableCell className="capitalize">{movement.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {movement.delta > 0 ? "+" : ""}
                      {movement.delta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{movement.balanceAfter}</TableCell>
                    <TableCell className="max-w-64 truncate">{movement.reason}</TableCell>
                    <TableCell>{movement.actorName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
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
