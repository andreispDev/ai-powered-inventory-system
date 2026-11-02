"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Button } from "@/components/ui/button";
import { useSubmit } from "@/hooks/use-submit";
import type { ActionResult } from "@/server/guard/errors";

const MAX_SIDE = 512;

/** Shrinks the picture in the browser, so large phone photos still upload quickly. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.85);
}

export function ImagePicker({
  label,
  hasImage,
  preview,
  save,
  remove,
}: {
  label: string;
  hasImage: boolean;
  /** Draws the current picture, or the newly picked one when given a URL */
  preview: (url: string | null) => ReactNode;
  save: (input: { base64: string }, retryKey?: string) => Promise<ActionResult<void>>;
  remove: (input: Record<string, never>, retryKey?: string) => Promise<ActionResult<void>>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const saving = useSubmit(save);
  const removing = useSubmit(remove);
  const [picked, setPicked] = useState<string | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error("Please choose a PNG, JPEG or WebP image.");
      return;
    }
    try {
      setPicked(await shrink(file));
    } catch {
      toast.error("That image couldn't be read. Please try another.");
    }
  }

  const finish = (result: ActionResult<void> | null, message: string) => {
    if (result?.ok) {
      toast.success(message);
      setPicked(null);
      router.refresh();
    } else if (result) toast.error(result.message);
  };
  const busy = saving.state.pending || removing.state.pending || saving.state.offline;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {preview(picked)}
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label} onChange={onPick} />
        {picked ? (
          <>
            <Button disabled={busy} onClick={async () => finish(await saving.submit({ base64: picked.split(",")[1] }), `${label} saved.`)}>
              Save
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPicked(null)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <ImagePlus aria-hidden />
              {hasImage ? "Change photo" : "Upload photo"}
            </Button>
            {hasImage && (
              <Confirm
                title={`Remove ${label.toLowerCase()}?`}
                description="It goes back to the default icon. You can upload a new one anytime."
                confirmLabel="Remove"
                destructive
                onConfirm={async () => finish(await removing.submit({}), `${label} removed.`)}
              >
                <Button variant="ghost" disabled={busy}>
                  <Trash2 aria-hidden />
                  Remove
                </Button>
              </Confirm>
            )}
          </>
        )}
      </div>
    </div>
  );
}
