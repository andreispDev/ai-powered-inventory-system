import type { FieldDef } from "@/modules/categories/field-schema";
import { ITEM_STATUSES } from "./schemas";

export function formatAttribute(value: unknown, field: FieldDef, people: Readonly<Record<string, string>>): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (field.type === "person") return people[String(value)] ?? "—";
  return field.config.unit ? `${value} ${field.config.unit}` : String(value);
}

export function statusLabel(status: string) {
  return ITEM_STATUSES.find((s) => s.value === status)?.label ?? status;
}
