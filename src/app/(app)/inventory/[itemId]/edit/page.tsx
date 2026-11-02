import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { listFields } from "@/modules/categories/queries";
import { ItemForm } from "@/modules/inventory/item-form";
import { listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { category, item } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Edit item" };

type Props = { params: Promise<{ itemId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("item.update")) return <AccessDenied />;
  const { itemId } = await params;
  if (!z.uuid().safeParse(itemId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    const [row] = await tx.select().from(item).where(eq(item.id, itemId));
    if (!row || row.deletedAt) return null;
    const [parent] = await tx.select({ disabledFields: category.disabledFields }).from(category).where(eq(category.id, row.categoryId));
    return { row, disabledFields: parent?.disabledFields ?? [], fields: await listFields(tx, row.categoryId), people: await listPeople(tx) };
  });
  if (!data) notFound();

  const { row } = data;
  return (
    <PageContainer>
      <PageHeader title={`Edit ${row.name}`} description="Quantity changes through stock movements, so it isn't edited here." />
      <ItemForm
        categoryId={row.categoryId}
        fields={data.fields.map(({ key, label, type, config }) => ({ key, label, type, config }))}
        people={data.people}
        disabledFields={data.disabledFields}
        item={{
          id: row.id,
          version: row.version,
          name: row.name,
          sku: row.sku,
          status: row.status,
          unit: row.unit,
          location: row.location,
          condition: row.condition,
          serialNumber: row.serialNumber,
          supplier: row.supplier,
          unitCost: row.unitCost,
          purchaseDate: row.purchaseDate,
          warrantyExpiry: row.warrantyExpiry,
          notes: row.notes,
          attributes: row.attributes,
        }}
      />
    </PageContainer>
  );
}

export default function EditItemPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
