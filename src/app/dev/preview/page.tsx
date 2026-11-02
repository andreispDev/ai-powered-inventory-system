import { Boxes, FolderTree, PackageX } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { DonutChart } from "@/components/charts/donut-chart";
import { PageContainer, PageHeader, PageSkeleton, StatCard } from "@/components/shell/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DeleteItemButton, MoveStockDialog } from "@/modules/inventory/item-actions";
import { FormField } from "@/components/forms/form";
import { effectivePermissions, type Role } from "@/server/authz/catalog";

// Development only: shows the shell per role with sample names and no real data or session.
async function Preview({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await connection();
  const { role: requested } = await searchParams;
  const role: Role = requested === "developer" || requested === "admin" ? requested : "user";
  const officeName = role === "developer" ? null : "Sample Office";
  const permissions = effectivePermissions(role, []);

  return (
    <AppShell
      user={{ name: `Sample ${role}`, email: `${role}@example.test`, image: null, role, officeName, permissions, preferences: null }}
    >
      <PageContainer>
        <PageHeader
          title={`Sample ${role}`}
          description="Preview of the navigation and components. Actions here can't save anything."
          actions={
            <>
              <MoveStockDialog itemId="00000000-0000-4000-8000-000000000000" unit="pcs" quantity={10} />
              <DeleteItemButton id="00000000-0000-4000-8000-000000000000" name="Sample item" />
            </>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Items" icon={Boxes} value="128" />
          <StatCard label="Out of stock" icon={PackageX} value="4" />
          <StatCard label="Categories" icon={FolderTree} value="9" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Items by status</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                totalLabel="Items"
                empty="No items yet."
                slices={[
                  { label: "Active", value: 96 },
                  { label: "In repair", value: 18 },
                  { label: "Retired", value: 10 },
                  { label: "Lost", value: 4 },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Items by category</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                totalLabel="Items"
                empty="No items yet."
                slices={[
                  { label: "Laptops", value: 44 },
                  { label: "Furniture", value: 30 },
                  { label: "Supplies", value: 25 },
                  { label: "Medical", value: 15 },
                  { label: "Vehicles", value: 8 },
                  { label: "Tools", value: 6 },
                ]}
              />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Form fields</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="sample-name" label="Name" required help="Help text sits under the field.">
              <Input id="sample-name" defaultValue="ThinkPad T14" />
            </FormField>
            <FormField id="sample-status" label="Status">
              <NativeSelect id="sample-status">
                <option>Active</option>
                <option>In repair</option>
              </NativeSelect>
            </FormField>
            <FormField id="sample-error" label="SKU" errors={["Another item already uses this SKU."]}>
              <Input id="sample-error" defaultValue="IT-001" />
            </FormField>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}

export default function PreviewPage(props: { searchParams: Promise<{ role?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Preview {...props} />
    </Suspense>
  );
}
