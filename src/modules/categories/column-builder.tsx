"use client";

import { ArrowDown, ArrowUp, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { addField, moveField, setFieldRetired, updateField } from "./actions";
import { FIELD_TYPES, isChoice, isNumeric, type FieldConfig, type FieldType } from "./field-schema";

type Field = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  config: FieldConfig;
  retired: boolean;
};

const typeLabel = (type: FieldType) => FIELD_TYPES.find((t) => t.id === type)?.label ?? type;
const number = (value: string) => (value === "" || Number.isNaN(Number(value)) ? undefined : Number(value));

function FieldEditor({ categoryId, field, onClose }: { categoryId: string; field?: Field; onClose?: () => void }) {
  const router = useRouter();
  const add = useSubmit(addField);
  const update = useSubmit(updateField);
  const { state } = field ? update : add;

  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [required, setRequired] = useState(field?.config.required ?? false);
  const [help, setHelp] = useState(field?.config.help ?? "");
  const [unit, setUnit] = useState(field?.config.unit ?? "");
  const [min, setMin] = useState(field?.config.min?.toString() ?? "");
  const [max, setMax] = useState(field?.config.max?.toString() ?? "");
  const [pattern, setPattern] = useState(field?.config.pattern ?? "");
  const [options, setOptions] = useState(field?.config.options?.join(", ") ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const config: FieldConfig = {
      required,
      help: help || undefined,
      unit: unit || undefined,
      min: isNumeric(type) ? number(min) : undefined,
      max: isNumeric(type) ? number(max) : undefined,
      pattern: type === "text" && pattern ? pattern : undefined,
      options: isChoice(type)
        ? options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined,
    };
    const result = field
      ? await update.submit({ id: field.id, label, config })
      : await add.submit({ categoryId, label, type, config });
    if (!result?.ok) return;
    toast.success(field ? "Column saved." : "Column added.");
    if (!field) {
      setLabel("");
      setOptions("");
      setHelp("");
      setUnit("");
      setMin("");
      setMax("");
      setPattern("");
      setRequired(false);
    }
    onClose?.();
    router.refresh();
  }

  const id = (name: string) => `${field?.id ?? "new"}-${name}`;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={id("label")} label="Column name" required errors={state.fieldErrors.label}>
          <Input id={id("label")} required value={label} onChange={(event) => setLabel(event.target.value)} />
        </FormField>
        <FormField id={id("type")} label="Type" help={field ? "The type can't change once created." : undefined}>
          <select
            id={id("type")}
            disabled={!!field}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm disabled:opacity-60"
            value={type}
            onChange={(event) => setType(event.target.value as FieldType)}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {isChoice(type) && (
        <FormField id={id("options")} label="Choices" required help="Separate with commas." errors={state.fieldErrors.options}>
          <Input id={id("options")} value={options} onChange={(event) => setOptions(event.target.value)} />
        </FormField>
      )}
      {isNumeric(type) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id={id("min")} label="Minimum" errors={state.fieldErrors.config}>
            <Input id={id("min")} type="number" step="any" value={min} onChange={(event) => setMin(event.target.value)} />
          </FormField>
          <FormField id={id("max")} label="Maximum">
            <Input id={id("max")} type="number" step="any" value={max} onChange={(event) => setMax(event.target.value)} />
          </FormField>
          <FormField id={id("unit")} label="Unit" help="Such as GB or kg.">
            <Input id={id("unit")} value={unit} onChange={(event) => setUnit(event.target.value)} />
          </FormField>
        </div>
      )}
      {type === "text" && (
        <FormField id={id("pattern")} label="Format rule" help="Optional, advanced: a regular expression.">
          <Input id={id("pattern")} className="font-mono" value={pattern} onChange={(event) => setPattern(event.target.value)} />
        </FormField>
      )}
      <FormField id={id("help")} label="Help text">
        <Input id={id("help")} value={help} onChange={(event) => setHelp(event.target.value)} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={required} onCheckedChange={(value) => setRequired(value === true)} />
        Required
      </label>
      <FormError state={state} />
      <div className="flex gap-2">
        <SubmitButton state={state}>{field ? "Save column" : "Add column"}</SubmitButton>
        {onClose && (
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function FieldRow({ categoryId, field, first, last, canEdit }: { categoryId: string; field: Field; first: boolean; last: boolean; canEdit: boolean }) {
  const router = useRouter();
  const move = useSubmit(moveField);
  const retire = useSubmit(setFieldRetired);
  const [editing, setEditing] = useState(false);

  const after = (result: { ok: boolean; message?: string } | null) => {
    if (result?.ok) router.refresh();
    else if (result) toast.error(result.message ?? "That didn't work.");
  };

  if (editing) {
    return (
      <li className="p-3">
        <FieldEditor categoryId={categoryId} field={field} onClose={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className={`flex items-center gap-2 p-3 ${field.retired ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {field.label}
          {field.config.unit ? ` (${field.config.unit})` : ""}
          {field.config.required && <span className="text-destructive"> *</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {typeLabel(field.type)}
          {field.config.options?.length ? ` · ${field.config.options.join(", ")}` : ""}
        </p>
      </div>
      {field.retired && <Badge variant="outline">Retired</Badge>}
      {canEdit && !field.retired && (
        <>
          <Button variant="ghost" size="icon" aria-label={`Move ${field.label} up`} disabled={first || move.state.pending}
            onClick={async () => after(await move.submit({ id: field.id, direction: "up" }))}>
            <ArrowUp aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Move ${field.label} down`} disabled={last || move.state.pending}
            onClick={async () => after(await move.submit({ id: field.id, direction: "down" }))}>
            <ArrowDown aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Edit ${field.label}`} onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
          </Button>
        </>
      )}
      {canEdit && (
        <Button variant="ghost" size="icon" aria-label={field.retired ? `Restore ${field.label}` : `Retire ${field.label}`} disabled={retire.state.pending}
          onClick={async () => after(await retire.submit({ id: field.id, retired: !field.retired }))}>
          {field.retired ? <RotateCcw aria-hidden /> : <Trash2 aria-hidden />}
        </Button>
      )}
    </li>
  );
}

export function ColumnBuilder({ categoryId, fields, canEdit }: { categoryId: string; fields: Field[]; canEdit: boolean }) {
  const active = fields.filter((field) => !field.retired);
  const retired = fields.filter((field) => field.retired);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Custom columns</CardTitle>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">No custom columns yet. Every item already has standard columns like name, SKU and location.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {[...active, ...retired].map((field) => (
                <FieldRow
                  key={field.id}
                  categoryId={categoryId}
                  field={field}
                  canEdit={canEdit}
                  first={field.id === active[0]?.id}
                  last={field.id === active.at(-1)?.id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Add a column</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldEditor categoryId={categoryId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
