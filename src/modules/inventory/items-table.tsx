"use client";

import { ArrowDown, ArrowUp, Columns3, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUrlState } from "@/components/data-table/pagination";
import { RowActions, RowLink } from "@/components/data-table/row-actions";
import { LocalTime } from "@/components/shell/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FieldDef } from "@/modules/categories/field-schema";
import { formatAttribute, statusLabel } from "./format";
import { DeleteItemButton } from "./item-actions";

export type ItemRow = {
  id: string;
  name: string;
  createdAt: Date;
  status: string;
  quantity: number;
  unit: string;
  location: string | null;
  attributes: Record<string, unknown>;
  categoryName: string;
  officeName: string;
};

type Column = {
  id: string;
  label: string;
  sort?: string;
  align?: "right";
  render: (row: ItemRow) => React.ReactNode;
};

const STORAGE_PREFIX = "columns:";

export function ItemsTable({
  rows,
  fields,
  people,
  showOffice,
  storageKey,
  hideLocation = false,
  canEdit = false,
  canDelete = false,
  records = false,
  hideCategory = false,
  manageColumnsHref,
}: {
  rows: ItemRow[];
  fields: readonly FieldDef[];
  people: Readonly<Record<string, string>>;
  showOffice: boolean;
  storageKey: string;
  hideLocation?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  records?: boolean;
  hideCategory?: boolean;
  /** The category's own settings, when one is showing and this person may edit it */
  manageColumnsHref?: string;
}) {
  const base = records ? "/records" : "/inventory";
  const { params, set, pending } = useUrlState();
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(stored ? JSON.parse(stored) : []);
    } catch {
      setHidden([]);
    }
  }, [storageKey]);

  const toggle = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next));
    } catch {
      // Blocked storage only means the choice isn't remembered.
    }
  };

  const columns: Column[] = [
    {
      id: "name",
      label: "Name",
      sort: "name",
      render: (row) => (
        <Link href={`${base}/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    ...(hideCategory ? [] : [{ id: "category", label: "Category", render: (row: ItemRow) => row.categoryName }]),
    ...(showOffice ? [{ id: "office", label: "Office", render: (row: ItemRow) => row.officeName }] : []),
    {
      id: "quantity",
      label: "Qty",
      sort: "quantity",
      align: "right" as const,
      render: (row) => {
        const out = row.quantity === 0;
        return (
          <span className={out ? "text-warning font-medium" : undefined}>
            {row.quantity.toLocaleString()} {row.unit}
            {out && <span className="sr-only"> (out of stock)</span>}
          </span>
        );
      },
    },
    {
      id: "status",
      label: "Status",
      sort: "status",
      render: (row) => <Badge variant={row.status === "active" ? "secondary" : "outline"}>{statusLabel(row.status)}</Badge>,
    },
    ...(hideLocation ? [] : [{ id: "location", label: "Location", sort: "location", render: (row: ItemRow) => row.location ?? "—" }]),
    ...fields.map(
      (field): Column => ({
        id: `attr:${field.key}`,
        label: field.label,
        sort: `attr:${field.key}`,
        render: (row) => formatAttribute(row.attributes[field.key], field, people),
      }),
    ),
    { id: "createdAt", label: "Date added", sort: "createdAt", render: (row) => <LocalTime date={row.createdAt} /> },
  ];

  const shown = records ? columns.filter((column) => column.id !== "quantity" && column.id !== "status") : columns;
  const visible = shown.filter((column) => !hidden.includes(column.id));
  const sort = params.get("sort") ?? "name";
  const direction = params.get("dir") === "desc" ? "desc" : "asc";

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 px-3 pt-3">
        {manageColumnsHref && (
          <Button variant="outline" size="sm" asChild>
            <Link href={manageColumnsHref}>
              <Pencil aria-hidden />
              Edit columns
            </Link>
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 aria-hidden />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-80 w-56 space-y-2 overflow-y-auto">
            {shown.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!hidden.includes(column.id)}
                  disabled={column.id === "name"}
                  onCheckedChange={() => toggle(column.id)}
                />
                {column.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className={`transition-opacity duration-[var(--motion-fast)] ${pending ? "opacity-60" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow>
              {visible.map((column) => {
                const active = column.sort === sort;
                return (
                  <TableHead
                    key={column.id}
                    className={column.align === "right" ? "text-right" : undefined}
                    aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:underline"
                        onClick={() => set({ sort: column.sort!, dir: active && direction === "asc" ? "desc" : "asc" })}
                      >
                        {column.label}
                        {active && (direction === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                      </button>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                );
              })}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {visible.map((column) => (
                  <TableCell key={column.id} className={column.align === "right" ? "text-right tabular-nums" : undefined}>
                    {column.render(row)}
                  </TableCell>
                ))}
                <TableCell>
                  <RowActions>
                    <RowLink href={`${base}/${row.id}`} icon={Eye} label="View" />
                    {canEdit && <RowLink href={`${base}/${row.id}/edit`} icon={Pencil} label="Edit" />}
                    {canDelete && <DeleteItemButton id={row.id} name={row.name} size="sm" records={records} />}
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
