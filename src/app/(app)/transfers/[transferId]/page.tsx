import { ArrowLeftRight, MessageSquareReply } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/modules/categories/queries";
import { CancelTransferButton, RespondToTransfer } from "@/modules/custody/custody-actions";
import { getTransfer } from "@/modules/custody/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Transfer" };

type Props = { params: Promise<{ transferId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  const { transferId } = await params;
  if (!z.uuid().safeParse(transferId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    // RLS hides transfers that don't involve this office.
    const row = await getTransfer(tx, transferId);
    if (!row) return null;
    const receiving = row.toOfficeId === actor.officeId && row.status === "pending" && actor.permissions.includes("transfer.respond");
    const categories = receiving ? (await listCategories(tx)).filter((c) => !c.archivedAt) : [];
    return { row, receiving, categories };
  });
  if (!data) notFound();

  const { row } = data;
  const summary = `${row.quantity} ${row.unit} of ${row.itemName} from ${row.fromOfficeName}.`;
  const canCancel = row.status === "pending" && row.fromOfficeId === actor.officeId && actor.permissions.includes("transfer.create");
  const details: [string, string][] = [
    ["Quantity", `${row.quantity} ${row.unit}`],
    ["SKU", row.itemSku ?? "—"],
    ["From", row.fromOfficeName],
    ["To", row.toOfficeName],
    ["Requested by", row.requestedByName],
    ...(row.respondedByName ? ([["Answered by", row.respondedByName]] as [string, string][]) : []),
    ...(row.note ? ([["Note", row.note]] as [string, string][]) : []),
  ];

  return (
    <PageContainer width="narrow">
      <PageHeader title={row.itemName} description="Transfer between offices" actions={canCancel ? <CancelTransferButton id={row.id} /> : undefined} />
      <Card>
        <CardHeader>
          <CardTitle icon={ArrowLeftRight}>
            Details
            <Badge className="capitalize" variant={row.status === "pending" ? "default" : row.status === "accepted" ? "secondary" : "outline"}>
              {row.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">Requested</dt>
              <dd className="text-right font-medium">
                <LocalTime date={row.createdAt} />
              </dd>
            </div>
            {row.respondedAt && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Answered</dt>
                <dd className="text-right font-medium">
                  <LocalTime date={row.respondedAt} />
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      {data.receiving && (
        <Card>
          <CardHeader>
            <CardTitle icon={MessageSquareReply}>Your answer</CardTitle>
          </CardHeader>
          <CardContent>
            <RespondToTransfer
              id={row.id}
              summary={summary}
              categories={data.categories.map(({ id, name }) => ({ id, name }))}
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

export default function TransferPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
