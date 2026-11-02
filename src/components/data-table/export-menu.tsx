"use client";

import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useConnection } from "@/components/connectivity/connectivity";
import { FormField } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ExportTable } from "@/lib/export-format";

const STORAGE_KEY = "pdf-header";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** PDFs can't hold every image type, so the logo is redrawn as a PNG. */
async function logoAsPng(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), width: bitmap.width, height: bitmap.height };
}

export function ExportMenu({ dataset, defaultTitle, organization, logoUrl }: { dataset: "inventory" | "records" | "logs"; defaultTitle: string; organization: string; logoUrl?: string | null }) {
  const params = useSearchParams();
  const offline = useConnection() !== "online";
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [header, setHeader] = useState({ organization, title: defaultTitle, note: "", showDate: true, showLogo: !!logoUrl, landscape: true });

  // The header people last used, so reports stay consistent. This browser only.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHeader((current) => ({ ...current, organization: stored.organization ?? current.organization, note: stored.note ?? "", showDate: stored.showDate ?? true, showLogo: !!logoUrl && (stored.showLogo ?? true), landscape: stored.landscape ?? true }));
      }
    } catch {
      // Blocked storage only means the defaults are used.
    }
  }, [logoUrl]);

  async function fetchTable(): Promise<ExportTable | null> {
    const query = new URLSearchParams(params.toString());
    query.delete("page");
    query.delete("size");
    query.set("dataset", dataset);
    const response = await fetch(`/api/export?${query}`);
    if (!response.ok) {
      const { message } = (await response.json().catch(() => ({ message: null }))) as { message: string | null };
      toast.error(message ?? "That export didn't work. Please try again.");
      return null;
    }
    const table = (await response.json()) as ExportTable;
    if (table.truncated) toast.warning(`Only the first ${table.rows.length.toLocaleString()} rows were exported. Use filters to narrow it down.`);
    return table;
  }

  async function exportCsv() {
    setBusy(true);
    try {
      const table = await fetchTable();
      if (!table) return;
      const { exportFileName, toCsv } = await import("@/lib/export-format");
      save(new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" }), exportFileName(table.title, "csv"));
      toast.success("CSV downloaded.");
    } catch {
      toast.error("That export didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const table = await fetchTable();
      if (!table) return;
      // Loaded only now, because it's large and most pages never need it.
      const { buildPdf, exportFileName } = await import("@/lib/export-format");
      const logo = header.showLogo && logoUrl ? await logoAsPng(logoUrl).catch(() => null) : null;
      const doc = buildPdf(table, { ...header, logo });
      save(doc.output("blob"), exportFileName(header.title || table.title, "pdf"));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(header));
      } catch {
        // Blocked storage only means it isn't remembered.
      }
      toast.success("PDF downloaded.");
      setDialog(false);
    } catch {
      toast.error("That export didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy || offline}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void exportCsv()}>
            <FileSpreadsheet aria-hidden />
            CSV file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog(true)}>
            <FileText aria-hidden />
            PDF file…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export to PDF</DialogTitle>
            <DialogDescription>Set the header shown on every page. The export follows your current filters.</DialogDescription>
          </DialogHeader>
          <form onSubmit={exportPdf} className="space-y-4">
            <FormField id="pdf-organization" label="Organization">
              <Input id="pdf-organization" maxLength={120} value={header.organization} onChange={(event) => setHeader({ ...header, organization: event.target.value })} />
            </FormField>
            <FormField id="pdf-title" label="Report title" required>
              <Input id="pdf-title" required maxLength={120} value={header.title} onChange={(event) => setHeader({ ...header, title: event.target.value })} />
            </FormField>
            <FormField id="pdf-note" label="Note" help="Optional, such as who it's for or the period it covers.">
              <Textarea id="pdf-note" maxLength={300} rows={2} value={header.note} onChange={(event) => setHeader({ ...header, note: event.target.value })} />
            </FormField>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {logoUrl && (
                <label className="flex items-center gap-2">
                  <Checkbox checked={header.showLogo} onCheckedChange={(checked) => setHeader({ ...header, showLogo: checked === true })} />
                  Workspace logo
                </label>
              )}
              <label className="flex items-center gap-2">
                <Checkbox checked={header.showDate} onCheckedChange={(checked) => setHeader({ ...header, showDate: checked === true })} />
                Date generated
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={header.landscape} onCheckedChange={(checked) => setHeader({ ...header, landscape: checked === true })} />
                Landscape
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || offline}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Download PDF
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
