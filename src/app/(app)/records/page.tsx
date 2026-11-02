import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { TableFilter, TablePagination, TableSearch } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { listCategories, listFields } from "@/modules/categories/queries";
import { ItemsTable } from "@/modules/inventory/items-table";
import { listItems, listPeople } from "@/modules/inventory/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Records" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("item.read")) return <AccessDenied />;

  const params = await searchParams;
  const { page, pageSize, offset } = parsePage(params);
  const q = param(params, "q")?.trim() || undefined;
  const requestedCategory = param(params, "category");
  const categoryId = z.uuid().safeParse(requestedCategory).success ? requestedCategory : undefined;
  const canRestore = actor.permissions.includes("item.restore");
  const deleted = canRestore && param(params, "view") === "deleted";

  const data = await readScoped(actor, async (tx) => {
    const categories = (await listCategories(tx)).filter((row) => row.kind === "records");
    const fields = categoryId ? await listFields(tx, categoryId) : [];
    const { rows, total } = await listItems(tx, {
      kind: "records",
      q,
      categoryId,
      deleted,
      sort: param(params, "sort"),
      direction: param(params, "dir") === "desc" ? "desc" : "asc",
      fields,
      offset,
      limit: pageSize,
    });
    const people = fields.some((field) => field.type === "person") ? await listPeople(tx) : [];
    return { categories, fields, rows, total, people };
  });

  const canCreate = actor.permissions.includes("item.create");

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Records"
        description="Work papers and anything else that isn't counted stock. These stay out of inventory."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href={categoryId ? `/records/new?category=${categoryId}` : "/records/new"}>
                <Plus aria-hidden />
                Add record
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch placeholder="Search name or reference…" />
        <TableFilter name="category" label="Category" options={data.categories.map((row) => ({ value: row.id, label: actor.officeId ? row.name : `${row.officeName}: ${row.name}` }))} />
        {canRestore && <TableFilter name="view" label="Show" options={[{ value: "deleted", label: "Deleted records" }]} />}
      </div>
      {data.total === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || categoryId ? "No records match" : deleted ? "No deleted records" : "No records yet"}
          description={data.categories.length === 0 ? "Create a category and choose Custom records to get started." : q || categoryId ? "Try clearing a filter." : "Add your first record to get started."}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ItemsTable
            records
            rows={data.rows}
            fields={data.fields}
            people={Object.fromEntries(data.people.map((person) => [person.id, person.name]))}
            showOffice={!actor.officeId}
            storageKey={`records:${categoryId ?? "all"}`}
            canEdit={actor.permissions.includes("item.update")}
            canDelete={actor.permissions.includes("item.delete")}
          />
          <TablePagination total={data.total} page={page} pageSize={pageSize} />
        </Card>
      )}
    </PageContainer>
  );
}

export default function RecordsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
