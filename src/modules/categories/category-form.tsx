"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmit } from "@/hooks/use-submit";
import { createCategory } from "./actions";

export function CategoryForm({ parents }: { parents: readonly { id: string; name: string }[] }) {
  const router = useRouter();
  const { submit, state } = useSubmit(createCategory);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ name, description, parentId: parentId || undefined });
    if (!result?.ok) return;
    toast.success("Category created. Now add its columns.");
    router.push(`/categories/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField id="name" label="Name" required errors={state.fieldErrors.name}>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField id="description" label="Description" errors={state.fieldErrors.description}>
        <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <FormField id="parentId" label="Inside category" help="Optional. Up to 3 levels." errors={state.fieldErrors.parentId}>
        <select
          id="parentId"
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">None (top level)</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormError state={state} />
      <SubmitButton state={state}>Create category</SubmitButton>
    </form>
  );
}
