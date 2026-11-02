"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setCategoryArchived } from "./actions";

export function CategoryArchiveButton({ id, archived, size }: { id: string; archived: boolean; size?: "sm" }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setCategoryArchived);
  return (
    <Confirm
      title={archived ? "Restore this category?" : "Archive this category?"}
      description={
        archived
          ? "People can add items to it and edit its columns again."
          : "No new items can be added to it. Its items and history are kept, and an admin can restore it."
      }
      confirmLabel={archived ? "Restore" : "Archive"}
      destructive={!archived}
      onConfirm={async () => {
        const result = await submit({ id, archived: !archived });
        if (result?.ok) {
          toast.success(archived ? "Category restored." : "Category archived.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" size={size} disabled={state.pending || state.offline}>
        {archived ? "Restore" : "Archive"}
      </Button>
    </Confirm>
  );
}
