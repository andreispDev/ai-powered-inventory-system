"use client";

import { Mail, Pencil, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { updateAccount } from "./actions";

export function EditAccountButton({ id, name, email, size }: { id: string; name: string; email: string; size?: "sm" }) {
  const router = useRouter();
  const { submit, state } = useSubmit(updateAccount);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState({ name, email });
  const emailChanged = values.email.trim().toLowerCase() !== email;

  async function save() {
    const result = await submit({ id, ...values });
    if (!result?.ok) return;
    toast.success(emailChanged ? "Account updated. They'll sign in with the new email." : "Account updated.");
    setOpen(false);
    router.refresh();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (emailChanged) setConfirming(true);
    else void save();
  }

  return (
    <>
      <Confirm
        open={confirming}
        onOpenChange={setConfirming}
        title="Change this sign-in email?"
        description={`${name} will be signed out everywhere, and sign-in codes will go to ${values.email.trim()} from now on. A notice goes to the old address.`}
        confirmLabel="Change email"
        onConfirm={save}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setValues({ name, email });
        }}
      >
        <DialogTrigger asChild>
          <Button variant={size ? "ghost" : "outline"} size={size} disabled={state.offline}>
            <Pencil aria-hidden />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>Change this person&apos;s name or the email they sign in with.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField id="edit-name" icon={User} label="Full name" required errors={state.fieldErrors.name}>
              <Input id="edit-name" required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
            </FormField>
            <FormField id="edit-email" icon={Mail} label="Email" required help="Sign-in codes are sent here." errors={state.fieldErrors.email}>
              <Input id="edit-email" type="email" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
            </FormField>
            <FormError state={state} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton state={state}>Save changes</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
