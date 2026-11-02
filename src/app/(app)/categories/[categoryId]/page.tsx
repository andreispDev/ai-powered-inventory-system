import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { CategoryArchiveButton } from "@/modules/categories/archive-button";
import { ColumnBuilder } from "@/modules/categories/column-builder";
import { getCategory, listFields } from "@/modules/categories/queries";
import { StandardFields } from "@/modules/categories/standard-fields";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Category" };

type Props = { params: Promise<{ categoryId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.read")) return <AccessDenied />;
  const { categoryId } = await params;
  if (!z.uuid().safeParse(categoryId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    const row = await getCategory(tx, categoryId);
    if (!row) return null;
    return { row, fields: await listFields(tx, categoryId, true) };
  });
  if (!data) notFound();

  const archived = !!data.row.archivedAt;
  return (
    <PageContainer width="wide">
      <PageHeader
        title={data.row.name}
        description={archived ? "This category is archived." : (data.row.description ?? undefined)}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${data.row.kind === "records" ? "records" : "inventory"}?category=${data.row.id}`}>{data.row.kind === "records" ? "View records" : "View items"}</Link>
            </Button>
            {actor.permissions.includes("category.archive") && <CategoryArchiveButton id={data.row.id} archived={archived} />}
          </>
        }
      />
      <StandardFields
        categoryId={data.row.id}
        disabled={data.row.disabledFields}
        records={data.row.kind === "records"}
        canEdit={actor.permissions.includes("category.update") && !archived}
      />
      <ColumnBuilder
        categoryId={data.row.id}
        canEdit={actor.permissions.includes("category.update") && !archived}
        fields={data.fields.map(({ id, key, label, type, config, retiredAt }) => ({
          id,
          key,
          label,
          type,
          config,
          retired: !!retiredAt,
        }))}
      />
    </PageContainer>
  );
}

export default function CategoryPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
