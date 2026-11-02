"use client";

import { AlignLeft, Boxes, FileText, FolderTree, type LucideIcon, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormActions, FormError, FormField } from "@/components/forms/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmit } from "@/hooks/use-submit";
import { createCategory } from "./actions";

const KINDS: { value: "stock" | "records"; label: string; icon: LucideIcon; help: string }[] = [
  { value: "stock", label: "Stock items", icon: Boxes, help: "Counted things in inventory, with quantities, stock moves and predictions." },
  { value: "records", label: "Custom records", icon: FileText, help: "Anything else, such as work papers. Just your own columns, kept out of inventory." },
];

export function CategoryForm({
  parents,
  defaultKind = "stock",
}: {
  parents: readonly { id: string; name: string; kind: "stock" | "records" }[];
  defaultKind?: "stock" | "records";
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(createCategory);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [kind, setKind] = useState(defaultKind);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ name, description, kind, parentId: parentId || undefined });
    if (!result?.ok) return;
    toast.success("Category created. Now add its columns.");
    router.push(`/categories/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What will this category hold?</legend>
        <p className="text-muted-foreground text-xs">This can&apos;t be changed later.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors duration-[var(--motion-fast)] has-focus-visible:ring-2 has-focus-visible:ring-ring ${kind === option.value ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
            >
              <input
                type="radio"
                name="kind"
                className="sr-only"
                checked={kind === option.value}
                onChange={() => {
                  setKind(option.value);
                  setParentId("");
                }}
              />
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <option.icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">{option.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField id="name" icon={Tag} label="Name" required errors={state.fieldErrors.name}>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField id="description" icon={AlignLeft} label="Description" errors={state.fieldErrors.description}>
        <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <FormField id="parentId" icon={FolderTree} label="Inside category" help="Optional. Up to 3 levels." errors={state.fieldErrors.parentId}>
        <NativeSelect
          id="parentId"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">None (top level)</option>
          {parents.filter((parent) => parent.kind === kind).map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormError state={state} />
      <FormActions state={state} submitLabel="Create category" />
    </form>
  );
}
