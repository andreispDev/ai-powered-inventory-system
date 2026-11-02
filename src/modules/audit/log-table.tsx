"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUrlState } from "@/components/data-table/pagination";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { diffValues } from "./diff";

type Row = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
  at: string;
  actorName: string | null;
  actorRole: string | null;
  officeName: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
const text = (value: unknown) => (value === undefined || value === null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value));

export function LogTable({ rows, showOffice, nextBefore }: { rows: Row[]; showOffice: boolean; nextBefore: string | null }) {
  const router = useRouter();
  const { params } = useUrlState();
  const [open, setOpen] = useState<Row | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const changes = open ? diffValues(open.before, open.after) : [];

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            {showOffice && <TableHead>Office</TableHead>}
            <TableHead>Action</TableHead>
            <TableHead>Record</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => setOpen(row)}>
              <TableCell className="whitespace-nowrap">
                <button type="button" className="hover:underline" onClick={() => setOpen(row)}>
                  {mounted ? when(row.at) : "…"}
                </button>
              </TableCell>
              <TableCell>{row.actorName ?? "System"}</TableCell>
              {showOffice && <TableCell>{row.officeName ?? "—"}</TableCell>}
              <TableCell className="font-mono text-xs">{row.action}</TableCell>
              <TableCell className="max-w-48 truncate text-xs">{row.entityType ? `${row.entityType} ${row.entityId?.slice(0, 8) ?? ""}` : "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setOpen(row)}>
                  Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end gap-2 border-t px-3 py-2">
        <Button variant="outline" size="sm" disabled={!params.get("before")} onClick={() => router.back()}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextBefore}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("before", nextBefore!);
            router.push(`?${next.toString()}`);
          }}
        >
          Next
        </Button>
      </div>
      <Sheet open={!!open} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{open.action}</SheetTitle>
                <SheetDescription>
                  {open.actorName ?? "System"}
                  {open.actorRole ? ` (${open.actorRole})` : ""} · {when(open.at)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4 text-sm">
                {changes.length > 0 ? (
                  <table className="w-full table-fixed text-left">
                    <thead className="text-muted-foreground text-xs">
                      <tr>
                        <th className="py-1 font-medium">Field</th>
                        <th className="py-1 font-medium">Before</th>
                        <th className="py-1 font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {changes.map((change) => (
                        <tr key={change.field} className="align-top">
                          <td className="py-1.5 pr-2 font-medium break-words">{change.field}</td>
                          <td className="text-destructive py-1.5 pr-2 break-words">− {text(change.before)}</td>
                          <td className="text-success py-1.5 break-words">+ {text(change.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted-foreground">No field changes were recorded for this entry.</p>
                )}
                <dl className="text-muted-foreground space-y-1 border-t pt-3 text-xs">
                  <div>Record: {open.entityType ?? "—"} {open.entityId ?? ""}</div>
                  <div>Office: {open.officeName ?? "—"}</div>
                  <div>IP address: {open.ip ?? "—"}</div>
                  <div>Request: {open.requestId ?? "—"}</div>
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
