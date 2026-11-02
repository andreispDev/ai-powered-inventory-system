import { FolderTree } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { param, type SearchParams } from "@/lib/pagination";
import { getCategory, listCategories, listFields } from "@/modules/categories/queries";
import { ItemForm } from "@/modules/inventory/item-form";
import { listItemNames, listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Add item" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("item.create")) return <AccessDenied />;
  const categoryId = param(await searchParams, "category");

  if (categoryId && z.uuid().safeParse(categoryId).success) {
    const data = await readScoped(actor, async (tx) => {
      const row = await getCategory(tx, categoryId);
      if (!row || row.archivedAt || row.kind !== "stock") return null;
      return { row, fields: await listFields(tx, categoryId), people: await listPeople(tx), savedNames: await listItemNames(tx, "stock") };
    });
    if (data) {
      return (
        <PageContainer>
          <PageHeader title="Add item" description={`In ${data.row.name}`} />
          <ItemForm
            categoryId={data.row.id}
            fields={data.fields.map(({ key, label, type, config }) => ({ key, label, type, config }))}
            people={data.people}
            savedNames={data.savedNames}
            disabledFields={data.row.disabledFields}
          />
        </PageContainer>
      );
    }
  }

  const categories = (await readScoped(actor, listCategories)).filter((c) => !c.archivedAt && c.kind === "stock");
  return (
    <PageContainer width="narrow">
      <PageHeader title="Add item" description="Which category does it belong to?" />
      {categories.length === 0 ? (
        <>
          <EmptyState icon={FolderTree} title="Create a category first" description="Every item belongs to a category." />
          <div className="text-center">
            <Button asChild>
              <Link href="/categories/new">New category</Link>
            </Button>
          </div>
        </>
      ) : (
        <ul className="divide-y rounded-lg border">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/inventory/new?category=${category.id}`} className="hover:bg-accent block px-4 py-3 text-sm font-medium">
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

export default function NewItemPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
