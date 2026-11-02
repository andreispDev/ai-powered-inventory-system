import { FolderTree, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState, PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCategories } from "@/modules/categories/queries";
import { requireActor } from "@/server/auth/session";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Categories" };

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("category.read")) return <AccessDenied />;
  const rows = await readScoped(actor, listCategories);
  const canCreate = actor.permissions.includes("category.create");
  const showOffice = !actor.officeId;
  const nameOf = new Map(rows.map((row) => [row.id, row.name]));

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Categories"
        description="Each category can have its own detailed columns."
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
      {rows.length === 0 ? (
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
                <TableHead>Inside</TableHead>
                {showOffice && <TableHead>Office</TableHead>}
                <TableHead className="text-right">Columns</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/categories/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.parentId ? nameOf.get(row.parentId) : "—"}</TableCell>
                  {showOffice && <TableCell>{row.officeName}</TableCell>}
                  <TableCell className="text-right tabular-nums">{row.fields}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.items}</TableCell>
                  <TableCell>
                    <Badge variant={row.archivedAt ? "outline" : "secondary"}>{row.archivedAt ? "Archived" : "Active"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content />
    </Suspense>
  );
}
