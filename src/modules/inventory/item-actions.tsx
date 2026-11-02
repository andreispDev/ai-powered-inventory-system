"use client";

import { ArrowDownToLine, ArrowUpFromLine, Hash, MessageSquareText, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { cn } from "@/lib/utils";
import { deleteItem, moveStock, restoreItem } from "./actions";
import { deltaOf, MOVEMENT_TYPES } from "./schemas";

type MovementType = (typeof MOVEMENT_TYPES)[number]["value"];

const ICONS: Record<MovementType, typeof RotateCcw> = {
  receive: ArrowDownToLine,
  issue: ArrowUpFromLine,
  return: RotateCcw,
  adjust: SlidersHorizontal,
};

export function MoveStockDialog({ itemId, unit, quantity }: { itemId: string; unit: string; quantity: number }) {
  const router = useRouter();
  const { submit, state } = useSubmit(moveStock);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MovementType>("receive");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const parsed = Number(amount);
  const after = amount !== "" && Number.isInteger(parsed) ? quantity + deltaOf(type, parsed) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ itemId, type, amount: parsed, reason });
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
          <DialogDescription>Every change is kept in this item&apos;s history.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Type</legend>
            <div className="grid grid-cols-2 gap-2">
              {MOVEMENT_TYPES.map((movement) => {
                const Icon = ICONS[movement.value];
                const selected = type === movement.value;
                return (
                  <button
                    key={movement.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setType(movement.value)}
                    className={cn(
                      "hover:bg-accent shadow-card rounded-lg border p-2.5 text-left transition-colors duration-[var(--motion-fast)]",
                      selected && "border-ring ring-ring bg-accent ring-1",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-4" aria-hidden />
                      {movement.label}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">{movement.help}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <FormField
            id="amount"
            icon={Hash}
            label="Amount"
            required
            help={type === "adjust" ? "Use a minus sign to reduce the count." : undefined}
            errors={state.fieldErrors.amount}
          >
            <Input id="amount" type="number" step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FormField>
          <FormField id="reason" icon={MessageSquareText} label="Reason" required errors={state.fieldErrors.reason}>
            <Input id="reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <dl className="bg-muted/60 flex justify-between rounded-lg px-3 py-2 text-sm" aria-live="polite">
            <div>
              <dt className="text-muted-foreground text-xs">Now</dt>
              <dd className="font-medium tabular-nums">
                {quantity} {unit}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-muted-foreground text-xs">After this</dt>
              <dd className={cn("font-medium tabular-nums", after !== null && after < 0 && "text-destructive")}>
                {after === null ? "—" : `${after} ${unit}`}
              </dd>
            </div>
          </dl>
          <FormError state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton state={state}>Record movement</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(deleteItem);
  return (
    <Confirm
      title={`Delete ${name}?`}
      description="It leaves the inventory list, and an admin can restore it. Its history is kept."
      confirmLabel="Delete item"
      destructive
      onConfirm={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("Item deleted.");
          router.push("/inventory");
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" disabled={state.pending || state.offline}>
        Delete
      </Button>
    </Confirm>
  );
}

export function RestoreItemButton({ id }: { id: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(restoreItem);
  return (
    <Confirm
      title="Restore this item?"
      description="It goes back into the inventory list with its history."
      confirmLabel="Restore item"
      onConfirm={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("Item restored.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" disabled={state.pending || state.offline}>
        Restore
      </Button>
    </Confirm>
  );
}
