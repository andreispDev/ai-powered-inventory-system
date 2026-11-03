"use client";

import { Folder, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import { setCategoryShape } from "./actions";

/** Shown only while the category is empty, so switching never strands any rows. */
export function CategoryShapeButton({ id, isFolder }: { id: string; isFolder: boolean }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setCategoryShape);
  return (
    <Confirm
      title={isFolder ? "Change this folder to a table?" : "Change this table to a folder?"}
      description={
        isFolder
          ? "It will hold rows with its own columns, instead of subcategories."
          : "It will hold subcategories, such as Asus Laptop, instead of rows. Its columns are set aside and come back if you change it back."
      }
      confirmLabel={isFolder ? "Change to table" : "Change to folder"}
      onConfirm={async () => {
        const result = await submit({ id, isFolder: !isFolder });
        if (result?.ok) {
          toast.success(isFolder ? "It's a table now." : "It's a folder now.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="outline" disabled={state.pending || state.offline}>
        {isFolder ? <Table2 aria-hidden /> : <Folder aria-hidden />}
        {isFolder ? "Change to table" : "Change to folder"}
      </Button>
    </Confirm>
  );
}
