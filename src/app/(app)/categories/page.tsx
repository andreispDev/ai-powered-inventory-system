import { Eye, FolderTree, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { TablePagination } from "@/components/data-table/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { listCategories } from "@/modules/categories/queries";
import { withDescendants } from "@/modules/categories/tree";
import { CategoryArchiveButton } from "@/modules/categories/archive-button";
import { PurgePanel } from "@/modules/categories/purge-panel";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Categories" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.read")) return <AccessDenied />;
  const rows = await readScoped(actor, listCategories);
  const { page, pageSize, offset } = parsePage(await searchParams);
  const canCreate = actor.permissions.includes("category.create");
  const showOffice = !actor.officeId;
  const topLevel = rows.filter((row) => !row.parentId);
  const below = (id: string) => withDescendants(rows, id).slice(1);
  const itemsIn = (id: string) => withDescendants(rows, id).reduce((sum, other) => sum + (rows.find((row) => row.id === other)?.items ?? 0), 0);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Categories"
        description="Open a category to see its subcategories and everything in it."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/categories/new">
                <Plus aria-hidden />
                New category
              </Link>
            </Button>
          ) : undefined
        }
      />
      {topLevel.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description={canCreate ? "Create your first category, then add the columns your office needs." : "Offices haven't created any categories yet."}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Subcategories</TableHead>
                {showOffice && <TableHead>Office</TableHead>}
                <TableHead className="text-right">Columns</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLevel.slice(offset, offset + pageSize).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/categories/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.kind === "records" ? "Records" : "Stock"}</TableCell>
                  <TableCell className="text-right tabular-nums">{below(row.id).length}</TableCell>
                  {showOffice && <TableCell>{row.officeName}</TableCell>}
                  <TableCell className="text-right tabular-nums">{row.fields}</TableCell>
                  <TableCell className="text-right tabular-nums">{itemsIn(row.id)}</TableCell>
                  <TableCell>
                    <Badge variant={row.archivedAt ? "outline" : "secondary"}>{row.archivedAt ? "Archived" : "Active"}</Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <RowLink href={`/categories/${row.id}`} icon={Eye} label="View" />
                      {actor.permissions.includes("category.archive") && <CategoryArchiveButton id={row.id} archived={!!row.archivedAt} size="sm" />}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={topLevel.length} page={page} pageSize={pageSize} />
        </Card>
      )}
      {actor.role === "admin" && actor.officeName && <PurgePanel officeName={actor.officeName} approved={actor.permissions.includes("data.purge")} />}
    </PageContainer>
  );
}

export default function CategoriesPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
