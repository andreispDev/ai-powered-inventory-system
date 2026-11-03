import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { param, type SearchParams } from "@/lib/pagination";
import { CategoryForm } from "@/modules/categories/category-form";
import { listCategories } from "@/modules/categories/queries";
import { ancestorsOf } from "@/modules/categories/tree";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "New category" };

const MAX_DEPTH = 3;

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.create")) return <AccessDenied />;
  const params = await searchParams;
  const parentId = param(params, "parent");
  const categories = parentId && z.uuid().safeParse(parentId).success ? await readScoped(actor, listCategories) : [];
  // Only a folder takes subcategories.
  const parent = categories.find((row) => row.id === parentId && row.isFolder && !row.archivedAt);
  // Network / Monitors / Asus is as deep as it goes, so a third level is always a table.
  const canNest = !!parent && ancestorsOf(categories, parent.id).length + 2 < MAX_DEPTH;
  return (
    <PageContainer width="narrow">
      <PageHeader title={parent ? `New subcategory in ${parent.name}` : "New category"} description={parent ? (canNest ? "Make it a folder for more subcategories, or a table with its own columns." : "Give it a name and the columns its table needs.") : "Choose what it holds. You'll add its subcategories next."} />
      <Card>
        <CardContent>
          {/* Keyed, so moving between parents starts a fresh form instead of keeping the last one's choices */}
          <CategoryForm key={parent?.id ?? "top"} parent={parent ? { id: parent.id, name: parent.name, kind: parent.kind } : undefined} defaultKind={param(params, "kind") === "stock" ? "stock" : "records"} canNest={canNest} />
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
