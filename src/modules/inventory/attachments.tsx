"use client";

import { Download, File as FileIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useConnection } from "@/components/connectivity/connectivity";
import { Confirm } from "@/components/feedback/confirm";
import { LocalTime } from "@/components/shell/local-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubmit } from "@/hooks/use-submit";
import { removeAttachment } from "./actions";
import { ATTACHMENT_ACCEPT, formatFileSize, MAX_ATTACHMENT_BYTES } from "./attachment-file";

export type AttachmentRow = { id: string; fileName: string; sizeBytes: number; createdAt: Date; uploadedByName: string | null };

function RemoveFile({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { submit, state } = useSubmit(removeAttachment);
  return (
    <Confirm
      title={`Remove ${name}?`}
      description="The file is permanently deleted. The logs keep a note that it existed."
      confirmLabel="Remove file"
      destructive
      onConfirm={async () => {
        const result = await submit({ id });
        if (result?.ok) {
          toast.success("File removed.");
          router.refresh();
        } else if (result) toast.error(result.message);
      }}
    >
      <Button variant="ghost" size="sm" disabled={state.pending || state.offline}>
        <Trash2 aria-hidden />
        Remove
      </Button>
    </Confirm>
  );
}

export function Attachments({ itemId, files, canEdit }: { itemId: string; files: readonly AttachmentRow[]; canEdit: boolean }) {
  const router = useRouter();
  const offline = useConnection() !== "online";
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clear() {
    setChosen(null);
    if (input.current) input.current.value = "";
  }

  async function upload() {
    if (!chosen) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", chosen);
      const response = await fetch(`/api/items/${itemId}/attachments`, { method: "POST", body });
      if (!response.ok) {
        const { message } = (await response.json().catch(() => ({ message: null }))) as { message: string | null };
        setError(message ?? "That file couldn't be uploaded.");
        return;
      }
      toast.success("File added.");
      clear();
      router.refresh();
    } catch {
      setError("That file couldn't be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Paperclip}>Files</CardTitle>
        <CardDescription>PDF, Word, Excel, PowerPoint, text, CSV or images, up to 10 MB each.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files attached yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <FileIcon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate font-medium">{file.fileName}</span>
                  <span className="text-muted-foreground block text-xs">
                    {formatFileSize(file.sizeBytes)}
                    {file.uploadedByName ? ` · ${file.uploadedByName}` : ""} · <LocalTime date={file.createdAt} />
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    {/* A plain link, because it's a file download rather than a page. */}
                    <a href={`/api/attachments/${file.id}`} download>
                      <Download aria-hidden />
                      Download
                    </a>
                  </Button>
                  {canEdit && <RemoveFile id={file.id} name={file.fileName} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              className="sr-only"
              aria-label="Choose a file"
              accept={ATTACHMENT_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setError(file && file.size > MAX_ATTACHMENT_BYTES ? "That file is over the 10 MB limit." : null);
                setChosen(file && file.size <= MAX_ATTACHMENT_BYTES ? file : null);
              }}
            />
            {chosen ? (
              <>
                <span className="min-w-0 truncate text-sm">
                  {chosen.name} <span className="text-muted-foreground">({formatFileSize(chosen.size)})</span>
                </span>
                <Button size="sm" disabled={uploading || offline} onClick={upload}>
                  <Upload aria-hidden />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
                <Button variant="outline" size="sm" disabled={uploading} onClick={clear}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" disabled={offline} onClick={() => input.current?.click()}>
                <Paperclip aria-hidden />
                Choose a file
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
