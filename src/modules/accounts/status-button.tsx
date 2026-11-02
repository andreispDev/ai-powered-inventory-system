"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { useSubmit } from "@/hooks/use-submit";
import { setAccountActive } from "./actions";

export function AccountStatusButton({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setAccountActive);

  async function run() {
    const result = await submit({ id, active: !active });
    if (result?.ok) {
      toast.success(active ? `${name} was deactivated.` : `${name} was reactivated.`);
      router.refresh();
    } else if (result) toast.error(result.message);
  }

  if (!active) {
    return (
      <Button variant="outline" disabled={state.pending || state.offline} onClick={run}>
        Reactivate
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={state.pending || state.offline}>
          Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access immediately. Their history stays in the logs, and you can reactivate them later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Deactivate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
