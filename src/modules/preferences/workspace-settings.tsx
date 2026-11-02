"use client";

import { Boxes, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { removeWorkspaceLogo, setWorkspaceLogo, setWorkspaceName } from "./image-actions";
import { ImagePicker } from "./image-picker";

export function WorkspaceSettings({ name, logoUrl }: { name: string | null; logoUrl: string | null }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setWorkspaceName);
  const [value, setValue] = useState(name ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ name: value });
    if (result?.ok) {
      toast.success("Workspace name saved.");
      router.refresh();
    }
  }

  return (
    <Card id="workspace" className="scroll-mt-20">
      <CardHeader>
        <CardTitle icon={Building2}>Workspace</CardTitle>
        <CardDescription>Your office&apos;s own name and logo, shown to everyone in your office instead of &ldquo;Inventory&rdquo;.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ImagePicker
          label="Workspace logo"
          hasImage={!!logoUrl}
          save={setWorkspaceLogo}
          remove={removeWorkspaceLogo}
          preview={(picked) => {
            const url = picked ?? logoUrl;
            return (
              <span className="bg-primary text-primary-foreground shadow-card flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url ? <img src={url} alt="Workspace logo" className="size-full bg-white object-contain" /> : <Boxes className="size-6" aria-hidden />}
              </span>
            );
          }}
        />
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField id="workspace-name" icon={Building2} label="Workspace name" help="Leave empty to use the app's default name." errors={state.fieldErrors.name}>
            <Input id="workspace-name" placeholder="Inventory" maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <div className="flex justify-end border-t pt-4">
            <SubmitButton state={state}>Save name</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
