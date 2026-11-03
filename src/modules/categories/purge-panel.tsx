"use client";

import { ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmit } from "@/hooks/use-submit";
import { purgeOfficeData } from "./actions";

const CHOICES = [
  {
    categories: false,
    label: "Delete all data",
    title: "Delete every item and record?",
    description: "Every row in every table is removed for good, with its stock history and files. Categories and their columns stay.",
  },
  {
    categories: true,
    label: "Delete all categories",
    title: "Delete every category and everything in it?",
    description: "Every folder, table, column and row is removed for good, with stock history and files. You start again from nothing.",
  },
];

/** Permanent removal for an office. Only works after a Developer approves, and each approval covers one use. */
export function PurgePanel({ officeName, approved }: { officeName: string; approved: boolean }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="text-destructive size-4" aria-hidden />
          Delete everything
        </CardTitle>
        <CardDescription>
          {approved
            ? "A Developer approved this. The approval covers one deletion, and it can't be undone."
            : "Needs a Developer's approval first. Ask for the data.purge permission, and each approval covers one deletion."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {approved ? (
          CHOICES.map((choice) => <PurgeButton key={choice.label} officeName={officeName} {...choice} />)
        ) : (
          <Button variant="outline" asChild>
            <Link href="/access">
              <ShieldAlert aria-hidden />
              Ask a Developer to approve
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PurgeButton({ officeName, categories, label, title, description }: { officeName: string } & (typeof CHOICES)[number]) {
  const router = useRouter();
  const { submit, state } = useSubmit(purgeOfficeData);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === officeName;

  async function onConfirm() {
    const result = await submit({ categories, confirm: typed });
    if (!result) return;
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const { items, categories: removed } = result.data;
    toast.success(`Deleted ${items.toLocaleString()} row${items === 1 ? "" : "s"}${categories ? ` and ${removed} categor${removed === 1 ? "y" : "ies"}` : ""}.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span className="bg-destructive/10 text-destructive mb-1 flex size-9 items-center justify-center rounded-full">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description} This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`purge-${categories}`}>
            Type <span className="font-semibold">{officeName}</span> to confirm
          </Label>
          <Input id={`purge-${categories}`} autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
          {state.fieldErrors.confirm && <p className="text-destructive text-sm">{state.fieldErrors.confirm[0]}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={!matches || state.pending || state.offline} onClick={onConfirm}>
            {state.pending ? "Deleting…" : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
