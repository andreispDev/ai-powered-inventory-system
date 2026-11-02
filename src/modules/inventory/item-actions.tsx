"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { deleteItem, moveStock, restoreItem } from "./actions";
import { MOVEMENT_TYPES } from "./schemas";

type MovementType = (typeof MOVEMENT_TYPES)[number]["value"];

export function MoveStockDialog({ itemId, unit, quantity }: { itemId: string; unit: string; quantity: number }) {
  const router = useRouter();
  const { submit, state } = useSubmit(moveStock);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MovementType>("receive");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ itemId, type, amount: Number(amount), reason });
    if (!result?.ok) return;
    toast.success(`Stock is now ${result.data.quantity} ${unit}.`);
    setOpen(false);
    setAmount("");
    setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Record movement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a stock movement</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Current stock: {quantity} {unit}
          </p>
          <FormField id="type" label="Type" help={MOVEMENT_TYPES.find((m) => m.value === type)?.help}>
            <select
              id="type"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as MovementType)}
            >
              {MOVEMENT_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="amount"
            label="Amount"
            required
            help={type === "adjust" ? "Use a minus sign to reduce the count." : undefined}
            errors={state.fieldErrors.amount}
          >
            <Input id="amount" type="number" step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FormField>
          <FormField id="reason" label="Reason" required errors={state.fieldErrors.reason}>
            <Input id="reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <SubmitButton state={state}>Record movement</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(deleteItem);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={state.pending || state.offline}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It leaves the inventory list, and an admin can restore it. Its history is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              const result = await submit({ id });
              if (result?.ok) {
                toast.success("Item deleted.");
                router.push("/inventory");
              } else if (result) toast.error(result.message);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RestoreItemButton({ id }: { id: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(restoreItem);
  return (
    <Button
      variant="outline"
      disabled={state.pending || state.offline}
      onClick={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("Item restored.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      Restore
    </Button>
  );
}
