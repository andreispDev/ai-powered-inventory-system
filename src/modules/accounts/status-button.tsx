"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setAccountActive } from "./actions";

export function AccountStatusButton({ id, name, active, size }: { id: string; name: string; active: boolean; size?: "sm" }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setAccountActive);

  async function run() {
    const result = await submit({ id, active: !active });
    if (result?.ok) {
      toast.success(active ? `${name} was deactivated.` : `${name} was reactivated.`);
      router.refresh();
    } else if (result) toast.error(result.message);
  }

  return (
    <Confirm
      title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      description={
        active
          ? "They lose access immediately. Their history stays in the logs, and you can reactivate them later."
          : "They'll be able to sign in again with an emailed code."
      }
      confirmLabel={active ? "Deactivate" : "Reactivate"}
      destructive={active}
      onConfirm={run}
    >
      <Button variant="outline" size={size} disabled={state.pending || state.offline}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
    </Confirm>
  );
}
