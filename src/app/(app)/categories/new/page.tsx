import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "@/modules/categories/category-form";
import { listCategories } from "@/modules/categories/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "New category" };

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.create")) return <AccessDenied />;
  const categories = await readScoped(actor, listCategories);
  return (
    <PageContainer width="narrow">
      <PageHeader title="New category" description="You'll add its columns on the next screen." />
      <Card>
        <CardContent>
          <CategoryForm parents={categories.filter((c) => !c.archivedAt).map(({ id, name }) => ({ id, name }))} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function NewCategoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
