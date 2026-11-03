import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { param, type SearchParams } from "@/lib/pagination";
import { CategoryForm } from "@/modules/categories/category-form";
import { getCategory } from "@/modules/categories/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "New category" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.create")) return <AccessDenied />;
  const params = await searchParams;
  const parentId = param(params, "parent");
  const parent = parentId && z.uuid().safeParse(parentId).success ? await readScoped(actor, (tx) => getCategory(tx, parentId)) : undefined;
  return (
    <PageContainer width="narrow">
      <PageHeader title={parent ? `New subcategory in ${parent.name}` : "New category"} description={parent ? "Give it a name and the columns it needs." : "Choose what it holds and which columns it needs."} />
      <Card>
        <CardContent>
          <CategoryForm parent={parent ? { id: parent.id, name: parent.name, kind: parent.kind } : undefined} defaultKind={param(params, "kind") === "stock" ? "stock" : "records"} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function NewCategoryPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
