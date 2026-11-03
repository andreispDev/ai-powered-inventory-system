import { Columns3, Folder, FolderPlus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { z } from "zod";
import { ExportMenu } from "@/components/data-table/export-menu";
import { TableFilter, TablePagination, TableSearch } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { getCategory, listCategories, listFields } from "@/modules/categories/queries";
import { ancestorsOf, withDescendants } from "@/modules/categories/tree";
import { ItemsTable } from "@/modules/inventory/items-table";
import { listItems, listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Category" };

const MAX_DEPTH = 3;

type Props = { params: Promise<{ categoryId: string }>; searchParams: Promise<SearchParams> };

async function Content({ params, searchParams }: Props) {
  const actor = await requireActor();
  const can = (permission: (typeof actor.permissions)[number]) => actor.permissions.includes(permission);
  if (!can("category.read") || !can("item.read")) return <AccessDenied />;
  const { categoryId } = await params;
  if (!z.uuid().safeParse(categoryId).success) notFound();

  const query = await searchParams;
  const { page, pageSize, offset } = parsePage(query);
  const q = param(query, "q")?.trim() || undefined;

  const data = await readScoped(actor, async (tx) => {
    const row = await getCategory(tx, categoryId);
    if (!row) return null;
    const categories = await listCategories(tx);
    const fields = await listFields(tx, categoryId);
    const attributes: Record<string, string> = {};
    for (const field of fields) {
      const value = param(query, `f_${field.key}`);
      if (value) attributes[field.key] = value;
    }
    const { rows, total } = await listItems(tx, {
      kind: row.kind,
      q,
      categoryIds: withDescendants(categories, categoryId),
      attributes,
      fields,
      sort: param(query, "sort"),
      direction: param(query, "dir") === "desc" ? "desc" : "asc",
      offset,
      limit: pageSize,
    });
    const people = fields.some((field) => field.type === "person") ? await listPeople(tx) : [];
    return { row, categories, fields, rows, total, people };
  });
  if (!data) notFound();

  const { row, categories } = data;
  const records = row.kind === "records";
  const noun = records ? "record" : "item";
  const archived = !!row.archivedAt;
  const path = ancestorsOf(categories, row.id);
  const subcategories = categories.filter((other) => other.parentId === row.id && !other.archivedAt);
  const countIn = (id: string) => withDescendants(categories, id).reduce((sum, other) => sum + (categories.find((c) => c.id === other)?.items ?? 0), 0);
  const addHref = `/${records ? "records" : "inventory"}/new?category=${row.id}`;
  // A top-level category is a folder, unless it was set up with its own columns before.
  const isFolder = path.length === 0 && data.fields.length === 0;
  const canAdd = can("item.create") && !archived && !isFolder;
  const canAddSub = can("category.create") && !archived && path.length + 1 < MAX_DEPTH;
  const filterable = data.fields.filter((field) => field.type === "select" || field.type === "multi_select" || field.type === "boolean");
  const filtered = q || Object.keys(query).some((name) => name.startsWith("f_"));

  return (
    <PageContainer width="wide">
      <div className="space-y-1">
        {path.length > 0 && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
            {path.map((parent) => (
              <Fragment key={parent.id}>
                <Link href={`/categories/${parent.id}`} className="hover:underline">
                  {parent.name}
                </Link>
                <span aria-hidden>/</span>
              </Fragment>
            ))}
          </p>
        )}
        <PageHeader
          title={row.name}
          description={archived ? "This category is archived." : (row.description ?? undefined)}
          actions={
            <>
              {can("export.run") && (
                <ExportMenu
                  dataset={records ? "records" : "inventory"}
                  defaultTitle={`${row.name} report`}
                  organization={actor.workspaceName ?? actor.officeName ?? "All offices"}
                  logoUrl={actor.logoUrl}
                  extraParams={{ category: row.id }}
                />
              )}
              {can("category.update") && (
                <Button variant="outline" asChild>
                  <Link href={`/categories/${row.id}/columns`}>
                    <Columns3 aria-hidden />
                    Edit columns
                  </Link>
                </Button>
              )}
              {canAddSub && (
                <Button variant={isFolder ? "default" : "outline"} asChild>
                  <Link href={`/categories/new?parent=${row.id}`}>
                    <FolderPlus aria-hidden />
                    Add subcategory
                  </Link>
                </Button>
              )}
              {canAdd && (
                <Button asChild>
                  <Link href={addHref}>
                    <Plus aria-hidden />
                    Add {noun}
                  </Link>
                </Button>
              )}
            </>
          }
        />
      </div>

      {subcategories.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {subcategories.map((sub) => (
            <Link key={sub.id} href={`/categories/${sub.id}`}>
              <Card className="surface-soft hover:shadow-raised h-full p-4 transition-shadow duration-[var(--motion-base)]">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Folder className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{sub.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {countIn(sub.id).toLocaleString()} {noun}
                      {countIn(sub.id) === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {(data.total > 0 || filtered || subcategories.length === 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch placeholder={`Search ${row.name}…`} />
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
        </div>
      )}

      {data.total === 0 ? (
        subcategories.length === 0 || filtered ? (
          <EmptyState
            icon={Folder}
            title={filtered ? `No ${noun}s match` : isFolder ? `Nothing in ${row.name} yet` : `No ${noun}s in ${row.name} yet`}
            description={filtered ? "Try clearing a filter." : isFolder ? (canAddSub ? "Add a subcategory, such as Laptop. Each one gets its own table and columns." : "Subcategories will appear here.") : canAdd ? `Add your first ${noun} to get started.` : `${noun[0].toUpperCase()}${noun.slice(1)}s will appear here.`}
          />
        ) : null
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ItemsTable
            records={records}
            hideCategory={subcategories.length === 0}
            rows={data.rows}
            fields={data.fields}
            people={Object.fromEntries(data.people.map((person) => [person.id, person.name]))}
            showOffice={!actor.officeId}
            storageKey={`category:${row.id}`}
            hideLocation={row.disabledFields.includes("location")}
            canEdit={can("item.update")}
            canDelete={can("item.delete")}
          />
          <TablePagination total={data.total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function CategoryPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
