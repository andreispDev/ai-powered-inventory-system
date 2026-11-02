"use client";

import { AlignLeft, Boxes, Columns3, FileText, Lock, type LucideIcon, Plus, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormActions, FormError, FormField } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmit } from "@/hooks/use-submit";
import { createCategory } from "./actions";
import { FIELD_TYPES, isChoice, OPTIONAL_ITEM_FIELDS, type FieldType, type OptionalItemField } from "./field-schema";

const KINDS: { value: "stock" | "records"; label: string; icon: LucideIcon; help: string }[] = [
  { value: "stock", label: "Stock items", icon: Boxes, help: "Counted things in inventory, with quantities, stock moves and predictions." },
  { value: "records", label: "Custom records", icon: FileText, help: "Anything else, such as work papers. Just your own columns, kept out of inventory." },
];

type Column = { rowId: number; label: string; type: FieldType; required: boolean; options: string };

export function CategoryForm({
  parent,
  defaultKind = "stock",
}: {
  /** A subcategory takes its type from its parent */
  parent?: { id: string; name: string; kind: "stock" | "records" };
  defaultKind?: "stock" | "records";
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(createCategory);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState(parent?.kind ?? defaultKind);
  const [columns, setColumns] = useState<Column[]>([{ rowId: 0, label: "", type: "text", required: false, options: "" }]);
  const [nextRow, setNextRow] = useState(1);
  const [hidden, setHidden] = useState<OptionalItemField[]>(["location"]);
  const given = kind === "stock" ? ["Name", "Quantity", "Status", "Date added"] : ["Name", "Date added"];
  const change = (rowId: number, changes: Partial<Column>) => setColumns(columns.map((column) => (column.rowId === rowId ? { ...column, ...changes } : column)));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({
      name,
      description,
      kind,
      parentId: parent?.id,
      disabledFields: hidden,
      // Rows left blank are just unused.
      columns: columns
        .filter((column) => column.label.trim())
        .map((column) => ({
          label: column.label,
          type: column.type,
          config: {
            required: column.required,
            options: isChoice(column.type) ? column.options.split(",").map((option) => option.trim()).filter(Boolean) : undefined,
          },
        })),
    });
    if (!result?.ok) return;
    toast.success("Category created.");
    router.push(`/categories/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!parent && (
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
                onChange={() => setKind(option.value)}
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
      )}
      <FormField id="name" icon={Tag} label="Name" required errors={state.fieldErrors.name}>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField id="description" icon={AlignLeft} label="Description" errors={state.fieldErrors.description}>
        <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
          <Columns3 className="text-primary size-4" aria-hidden />
          Which columns should it have?
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Always included:</span>
          {given.map((label) => (
            <span key={label} className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
              <Lock className="size-3" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Add your own, such as Serial no. or Date received. These become the fields on its form and the columns in its table.</p>
        {columns.map((column, index) => (
          <div key={column.rowId} className="space-y-2 rounded-md border p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Column ${index + 1} name`}
                placeholder={kind === "records" ? "Such as Client or Due date" : "Such as Serial no. or Date received"}
                className="min-w-40 flex-1"
                maxLength={60}
                value={column.label}
                onChange={(event) => change(column.rowId, { label: event.target.value })}
              />
              <NativeSelect aria-label={`Column ${index + 1} type`} className="w-40" value={column.type} onChange={(event) => change(column.rowId, { type: event.target.value as FieldType })}>
                {FIELD_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={column.required} onCheckedChange={(checked) => change(column.rowId, { required: checked === true })} />
                Required
              </label>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove column ${index + 1}`} onClick={() => setColumns(columns.filter((other) => other.rowId !== column.rowId))}>
                <X aria-hidden />
              </Button>
            </div>
            {isChoice(column.type) && (
              <Input aria-label={`Column ${index + 1} choices`} placeholder="Choices, separated with commas" value={column.options} onChange={(event) => change(column.rowId, { options: event.target.value })} />
            )}
          </div>
        ))}
        {state.fieldErrors.options && <p role="alert" className="text-destructive text-sm">A choice column needs at least one choice.</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setColumns([...columns, { rowId: nextRow, label: "", type: "text", required: false, options: "" }]);
            setNextRow(nextRow + 1);
          }}
        >
          <Plus aria-hidden />
          Add a column
        </Button>
        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-medium">Optional fields</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {OPTIONAL_ITEM_FIELDS.map((field) => (
              <label key={field.id} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={!hidden.includes(field.id)}
                  onCheckedChange={(checked) => setHidden(checked === true ? hidden.filter((name) => name !== field.id) : [...hidden, field.id])}
                />
                {field.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <FormError state={state} />
      <FormActions state={state} submitLabel={parent ? "Create subcategory" : "Create category"} />
    </form>
  );
}
