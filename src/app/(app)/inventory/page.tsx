import { Boxes, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { TableFilter, TablePagination, TableSearch } from "@/components/data-table/pagination";
import { ExportMenu } from "@/components/data-table/export-menu";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { getCategory, listCategories, listFields } from "@/modules/categories/queries";
import { ItemsTable } from "@/modules/inventory/items-table";
import { listItems, listPeople } from "@/modules/inventory/queries";
import { ITEM_STATUSES } from "@/modules/inventory/schemas";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Inventory" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("item.read")) return <AccessDenied />;

  const params = await searchParams;
  const { page, pageSize, offset } = parsePage(params);
  const q = param(params, "q")?.trim() || undefined;
  const status = param(params, "status");
  const requestedCategory = param(params, "category");
  const categoryId = z.uuid().safeParse(requestedCategory).success ? requestedCategory : undefined;
  const canRestore = actor.permissions.includes("item.restore");
  const deleted = canRestore && param(params, "view") === "deleted";

  const data = await readScoped(actor, async (tx) => {
    const categories = (await listCategories(tx)).filter((row) => row.kind === "stock");
    // With only one category, its columns show without having to choose it.
    const fieldsCategoryId = categoryId ?? (categories.length === 1 ? categories[0].id : undefined);
    const fields = fieldsCategoryId ? await listFields(tx, fieldsCategoryId) : [];
    const attributes: Record<string, string> = {};
    for (const field of fields) {
      const value = param(params, `f_${field.key}`);
      if (value) attributes[field.key] = value;
    }
    const { rows, total } = await listItems(tx, {
      q,
      categoryId,
      status,
      deleted,
      sort: param(params, "sort"),
      direction: param(params, "dir") === "desc" ? "desc" : "asc",
      attributes,
      fields,
      offset,
      limit: pageSize,
    });
    const people = fields.some((field) => field.type === "person") ? await listPeople(tx) : [];
    const selected = fieldsCategoryId ? await getCategory(tx, fieldsCategoryId) : undefined;
    return { categories, fieldsCategoryId, fields, rows, total, people, hideLocation: !!selected?.disabledFields.includes("location") };
  });

  const canCreate = actor.permissions.includes("item.create");
  const filtered = q || status || categoryId;
  const filterable = data.fields.filter((field) => field.type === "select" || field.type === "multi_select" || field.type === "boolean");

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Inventory"
        description={actor.officeName ?? "All offices, read-only."}
        actions={
          <>
            {actor.permissions.includes("export.run") && <ExportMenu dataset="inventory" defaultTitle="Inventory report" organization={actor.workspaceName ?? actor.officeName ?? "All offices"} logoUrl={actor.logoUrl} />}
            {canCreate && (
              <Button asChild>
                <Link href={categoryId ? `/inventory/new?category=${categoryId}` : "/inventory/new"}>
                  <Plus aria-hidden />
                  Add item
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch placeholder="Search name, SKU, serial…" />
        <TableFilter
          name="category"
          label="Category"
          options={data.categories.map((c) => ({ value: c.id, label: actor.officeId ? c.name : `${c.officeName}: ${c.name}` }))}
        />
        <TableFilter name="status" label="Status" options={ITEM_STATUSES} />
        {filterable.map((field) => (
          <TableFilter
            key={field.key}
            name={`f_${field.key}`}
            label={field.label}
            options={
              field.type === "boolean"
                ? [
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]
                : (field.config.options ?? []).map((option) => ({ value: option, label: option }))
            }
          />
        ))}
        {canRestore && <TableFilter name="view" label="Show" options={[{ value: "deleted", label: "Deleted items" }]} />}
      </div>
      {!data.fieldsCategoryId && data.categories.length > 1 && <p className="text-muted-foreground text-xs">Choose a category to see its own columns.</p>}
      {data.total === 0 ? (
        <EmptyState
          icon={Boxes}
          title={filtered ? "No items match" : deleted ? "No deleted items" : "No items yet"}
          description={filtered ? "Try clearing a filter." : canCreate ? "Add your first item to get started." : "Items will appear here once they're added."}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ItemsTable
            rows={data.rows}
            fields={data.fields}
            people={Object.fromEntries(data.people.map((person) => [person.id, person.name]))}
            showOffice={!actor.officeId}
            storageKey={data.fieldsCategoryId ?? "all"}
            hideLocation={data.hideLocation}
            manageColumnsHref={data.fieldsCategoryId && actor.permissions.includes("category.update") ? `/categories/${data.fieldsCategoryId}` : undefined}
            canEdit={actor.permissions.includes("item.update")}
            canDelete={actor.permissions.includes("item.delete")}
          />
          <TablePagination total={data.total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function InventoryPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
