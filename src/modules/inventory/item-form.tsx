"use client";

import {
  Activity,
  Banknote,
  Barcode,
  CalendarDays,
  CircleDot,
  Fingerprint,
  Hash,
  type LucideIcon,
  MapPin,
  Package,
  Ruler,
  ShieldCheck,
  StickyNote,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormActions, FormError, FormField } from "@/components/forms/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmit } from "@/hooks/use-submit";
import type { FieldDef } from "@/modules/categories/field-schema";
import { createItem, updateItem } from "./actions";
import { DynamicField } from "./dynamic-field";
import { ITEM_STATUSES } from "./schemas";

type Status = (typeof ITEM_STATUSES)[number]["value"];

export type ItemFormValues = {
  id: string;
  version: number;
  name: string;
  sku: string | null;
  status: Status;
  unit: string;
  location: string | null;
  condition: string | null;
  serialNumber: string | null;
  supplier: string | null;
  unitCost: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  attributes: Record<string, unknown>;
};

export function ItemForm({
  categoryId,
  fields,
  people,
  item,
  disabledFields = [],
}: {
  categoryId: string;
  fields: readonly FieldDef[];
  people: readonly { id: string; name: string }[];
  item?: ItemFormValues;
  disabledFields?: readonly string[];
}) {
  const router = useRouter();
  const create = useSubmit(createItem);
  const update = useSubmit(updateItem);
  const { state } = item ? update : create;

  const [values, setValues] = useState({
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    status: item?.status ?? ("active" as Status),
    unit: item?.unit ?? "pcs",
    location: item?.location ?? "",
    condition: item?.condition ?? "",
    serialNumber: item?.serialNumber ?? "",
    supplier: item?.supplier ?? "",
    unitCost: item?.unitCost ?? "",
    purchaseDate: item?.purchaseDate ?? "",
    warrantyExpiry: item?.warrantyExpiry ?? "",
    notes: item?.notes ?? "",
  });
  const [quantity, setQuantity] = useState("0");
  const [attributes, setAttributes] = useState<Record<string, unknown>>(item?.attributes ?? {});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = item
      ? await update.submit({ ...values, attributes, id: item.id, version: item.version })
      : await create.submit({ ...values, attributes, categoryId, quantity: Number(quantity) });
    if (!result?.ok) return;
    toast.success(item ? "Item saved." : "Item added.");
    router.push(`/inventory/${result.data.id}`);
  }

  const text = (name: keyof typeof values, label: string, icon: LucideIcon, extra?: { required?: boolean; type?: string; help?: string }) =>
    disabledFields.includes(name) ? null : (
    <FormField id={name} label={label} icon={icon} required={extra?.required} help={extra?.help} errors={state.fieldErrors[name]}>
      <Input
        id={name}
        type={extra?.type ?? "text"}
        required={extra?.required}
        step={extra?.type === "number" ? "any" : undefined}
        min={extra?.type === "number" ? 0 : undefined}
        value={values[name]}
        onChange={(event) => setValues({ ...values, [name]: event.target.value })}
      />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>The standard information every item has.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("name", "Name", Package, { required: true })}</div>
          {text("sku", "SKU or code", Barcode)}
          <FormField id="status" label="Status" icon={CircleDot} errors={state.fieldErrors.status}>
            <NativeSelect
              id="status"
              value={values.status}
              onChange={(event) => setValues({ ...values, status: event.target.value as Status })}
            >
              {ITEM_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {!item && (
            <FormField id="quantity" label="Starting quantity" icon={Hash} errors={state.fieldErrors.quantity}>
              <Input id="quantity" type="number" min={0} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </FormField>
          )}
          {text("unit", "Unit", Ruler, { required: true, help: "Such as pcs, box or kg." })}
          {text("location", "Location", MapPin)}
          {text("condition", "Condition", Activity)}
          {text("serialNumber", "Serial number", Fingerprint)}
          {text("supplier", "Supplier", Truck)}
          {text("unitCost", "Unit cost", Banknote, { type: "number" })}
          {text("purchaseDate", "Purchase date", CalendarDays, { type: "date" })}
          {text("warrantyExpiry", "Warranty expiry", ShieldCheck, { type: "date" })}
          <div className="sm:col-span-2">
            <FormField id="notes" label="Notes" icon={StickyNote} errors={state.fieldErrors.notes}>
              <Textarea id="notes" value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category details</CardTitle>
            <CardDescription>The columns your office set up for this category.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <DynamicField
                key={field.key}
                field={field}
                people={people}
                value={attributes[field.key]}
                errors={state.fieldErrors[`attr.${field.key}`]}
                onChange={(value) => setAttributes({ ...attributes, [field.key]: value })}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <FormError state={state} />
      <FormActions state={state} submitLabel={item ? "Save item" : "Add item"} />
    </form>
  );
}
