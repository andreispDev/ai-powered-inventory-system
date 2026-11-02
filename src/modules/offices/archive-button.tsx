"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setOfficeArchived } from "./actions";

export function ArchiveOfficeButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setOfficeArchived);
  return (
    <Button
      variant="outline"
      disabled={state.pending || state.offline}
      onClick={async () => {
        const result = await submit({ id, archived: !archived });
        if (result?.ok) {
          toast.success(archived ? "Office restored." : "Office archived.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      {archived ? "Restore office" : "Archive office"}
    </Button>
  );
}
