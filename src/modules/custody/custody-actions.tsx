"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useSubmit } from "@/hooks/use-submit";
import { acceptTransfer, cancelTransfer, createAssignment, createTransfer, rejectTransfer, returnAssignment } from "./actions";

type Option = { id: string; name: string };

const today = () => new Date().toLocaleDateString("en-CA");

function Footer({ state, label }: { state: Parameters<typeof SubmitButton>[0]["state"]; label: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="ghost">
          Cancel
        </Button>
      </DialogClose>
      <SubmitButton state={state}>{label}</SubmitButton>
    </DialogFooter>
  );
}

export function AssignDialog({ itemId, people }: { itemId: string; people: readonly Option[] }) {
  const router = useRouter();
  const { submit, state } = useSubmit(createAssignment);
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [since, setSince] = useState(today);
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ itemId, assigneeId, since, dueAt, note });
    if (!result?.ok) return;
    toast.success("Assigned. They'll be notified.");
    setOpen(false);
    setAssigneeId("");
    setDueAt("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Assign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign this item</DialogTitle>
          <DialogDescription>The person and your office&apos;s admins are told who has it and since when.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField id="assigneeId" label="Give to" required errors={state.fieldErrors.assigneeId}>
            <NativeSelect id="assigneeId" required value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Choose a person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="since" label="Since" required errors={state.fieldErrors.since}>
              <Input id="since" type="date" required value={since} onChange={(event) => setSince(event.target.value)} />
            </FormField>
            <FormField id="dueAt" label="Return by" help="Optional." errors={state.fieldErrors.dueAt}>
              <Input id="dueAt" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </FormField>
          </div>
          <FormField id="assign-note" label="Note" errors={state.fieldErrors.note}>
            <Input id="assign-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <Footer state={state} label="Assign" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(returnAssignment);
  return (
    <Confirm
      title={`Mark as returned by ${name}?`}
      description="This ends the assignment. It stays in the item's custody history."
      confirmLabel="Mark returned"
      onConfirm={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("Marked as returned.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" size="sm" disabled={state.pending || state.offline}>
        Return
      </Button>
    </Confirm>
  );
}

export function TransferDialog({
  itemId,
  unit,
  quantity,
  offices,
}: {
  itemId: string;
  unit: string;
  quantity: number;
  offices: readonly Option[];
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(createTransfer);
  const [open, setOpen] = useState(false);
  const [toOfficeId, setToOfficeId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ itemId, toOfficeId, quantity: Number(amount), note });
    if (!result?.ok) return;
    toast.success("Transfer sent. Stock moves when they accept.");
    setOpen(false);
    router.push(`/transfers/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={offices.length === 0}>
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer to another office</DialogTitle>
          <DialogDescription>
            You have {quantity} {unit}. Stock moves only when the other office accepts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField id="toOfficeId" label="To office" required errors={state.fieldErrors.toOfficeId}>
            <NativeSelect id="toOfficeId" required value={toOfficeId} onChange={(event) => setToOfficeId(event.target.value)}>
              <option value="">Choose an office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="transfer-quantity" label="Quantity" required errors={state.fieldErrors.quantity}>
            <Input id="transfer-quantity" type="number" min={1} max={quantity} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FormField>
          <FormField id="transfer-note" label="Note" errors={state.fieldErrors.note}>
            <Input id="transfer-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <Footer state={state} label="Send transfer" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RespondToTransfer({ id, categories, summary }: { id: string; categories: readonly Option[]; summary: string }) {
  const router = useRouter();
  const accept = useSubmit(acceptTransfer);
  const reject = useSubmit(rejectTransfer);
  const [categoryId, setCategoryId] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setConfirming(true);
      }}
    >
      <Confirm
        open={confirming}
        onOpenChange={setConfirming}
        title="Accept this transfer?"
        description={`${summary} Stock moves immediately and both offices are told.`}
        confirmLabel="Accept transfer"
        onConfirm={async () => {
          const result = await accept.submit({ id, categoryId });
          if (result?.ok) {
            toast.success("Transfer accepted. Stock has moved.");
            router.refresh();
          }
        }}
      />
      <FormField
        id="categoryId"
        label="Put it in category"
        required
        help="If you already have an item with the same SKU, the stock is added to it."
        errors={accept.state.fieldErrors.categoryId}
      >
        <NativeSelect id="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormError state={accept.state} />
      <FormError state={reject.state} />
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Confirm
          title="Reject this transfer?"
          description={`${summary} No stock moves, and the sending office is told.`}
          confirmLabel="Reject transfer"
          destructive
          onConfirm={async () => {
            const result = await reject.submit({ id });
            if (result?.ok) {
              toast.success("Transfer rejected.");
              router.refresh();
            }
          }}
        >
          <Button type="button" variant="outline" disabled={reject.state.pending || reject.state.offline}>
            Reject
          </Button>
        </Confirm>
        <SubmitButton state={accept.state}>Accept transfer</SubmitButton>
      </div>
    </form>
  );
}

export function CancelTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(cancelTransfer);
  return (
    <Confirm
      title="Cancel this transfer?"
      description="The other office is told. No stock has moved."
      confirmLabel="Cancel transfer"
      destructive
      onConfirm={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("Transfer cancelled.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" disabled={state.pending || state.offline}>
        Cancel transfer
      </Button>
    </Confirm>
  );
}
