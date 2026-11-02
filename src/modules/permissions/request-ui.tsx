"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSubmit } from "@/hooks/use-submit";
import { decideRequest, requestPermission } from "./request-actions";

export function RequestForm({ available }: { available: readonly string[] }) {
  const router = useRouter();
  const { submit, state } = useSubmit(requestPermission);
  const [permission, setPermission] = useState("");
  const [justification, setJustification] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ permission, justification });
    if (!result?.ok) return;
    toast.success("Request sent to the Developers.");
    setPermission("");
    setJustification("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField id="request-permission" label="Permission" required errors={state.fieldErrors.permission}>
        <NativeSelect id="request-permission" required value={permission} onChange={(event) => setPermission(event.target.value)}>
          <option value="">Choose a permission</option>
          {available.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="request-why" label="Why do you need it?" required errors={state.fieldErrors.justification}>
        <Input id="request-why" required value={justification} onChange={(event) => setJustification(event.target.value)} />
      </FormField>
      <FormError state={state} />
      <div className="flex justify-end border-t pt-4">
        <SubmitButton state={state}>Send request</SubmitButton>
      </div>
    </form>
  );
}

export function DecideButtons({ id, summary }: { id: string; summary: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(decideRequest);

  const decide = (approve: boolean) => async () => {
    const result = await submit({ id, approve });
    if (result?.ok) {
      toast.success(approve ? "Approved. It applies on their next request." : "Request declined.");
      router.refresh();
    } else if (result) toast.error(result.message);
  };

  return (
    <div className="flex shrink-0 gap-2">
      <Confirm title="Decline this request?" description={`${summary} They'll be told it was declined.`} confirmLabel="Decline" destructive onConfirm={decide(false)}>
        <Button variant="outline" size="sm" disabled={state.pending || state.offline}>
          Decline
        </Button>
      </Confirm>
      <Confirm title="Approve this request?" description={`${summary} This takes effect on their next request, until you change it.`} confirmLabel="Approve" onConfirm={decide(true)}>
        <Button size="sm" disabled={state.pending || state.offline}>
          Approve
        </Button>
      </Confirm>
    </div>
  );
}
