"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setOfficeArchived } from "./actions";

export function ArchiveOfficeButton({ id, archived, size }: { id: string; archived: boolean; size?: "sm" }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setOfficeArchived);
  return (
    <Confirm
      title={archived ? "Restore this office?" : "Archive this office?"}
      description={
        archived
          ? "New accounts can be added to it again."
          : "No new accounts can be added to it. Its data and history are kept, and you can restore it later."
      }
      confirmLabel={archived ? "Restore office" : "Archive office"}
      destructive={!archived}
      onConfirm={async () => {
        const result = await submit({ id, archived: !archived });
        if (result?.ok) {
          toast.success(archived ? "Office restored." : "Office archived.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" size={size} disabled={state.pending || state.offline}>
        {archived ? "Restore office" : "Archive office"}
      </Button>
    </Confirm>
  );
}
