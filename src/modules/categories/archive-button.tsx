"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setCategoryArchived } from "./actions";

export function CategoryArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setCategoryArchived);
  return (
    <Button
      variant="outline"
      disabled={state.pending || state.offline}
      onClick={async () => {
        const result = await submit({ id, archived: !archived });
        if (result?.ok) {
          toast.success(archived ? "Category restored." : "Category archived.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
