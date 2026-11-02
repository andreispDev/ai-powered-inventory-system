import { z } from "zod";

export const FIELD_TYPES = [
  { id: "text", label: "Short text" },
  { id: "long_text", label: "Long text" },
  { id: "integer", label: "Whole number" },
  { id: "decimal", label: "Decimal" },
  { id: "currency", label: "Currency" },
  { id: "date", label: "Date" },
  { id: "datetime", label: "Date and time" },
  { id: "boolean", label: "Yes / no" },
  { id: "select", label: "Single choice" },
  { id: "multi_select", label: "Multiple choice" },
  { id: "url", label: "Web link" },
  { id: "email", label: "Email" },
  { id: "person", label: "Person" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["id"];

export const MAX_FIELDS_PER_CATEGORY = 50;

/** Standard item fields a category can turn off */
export const OPTIONAL_ITEM_FIELDS = [
  { id: "location", label: "Location" },
  { id: "supplier", label: "Supplier" },
  { id: "unitCost", label: "Unit cost" },
  { id: "purchaseDate", label: "Purchase date" },
] as const;

export type OptionalItemField = (typeof OPTIONAL_ITEM_FIELDS)[number]["id"];

export type FieldConfig = {
  required?: boolean;
  help?: string;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  unit?: string;
};

export type FieldDef = { key: string; label: string; type: FieldType; config: FieldConfig };

const NUMERIC: readonly FieldType[] = ["integer", "decimal", "currency"];
export const isNumeric = (type: FieldType) => NUMERIC.includes(type);
export const isChoice = (type: FieldType) => type === "select" || type === "multi_select";

export const fieldConfigSchema = z
  .object({
    required: z.boolean().optional(),
    help: z.string().trim().max(200).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z
      .string()
      .max(100)
      .optional()
      .refine((value) => {
        if (!value) return true;
        try {
          new RegExp(value);
          return true;
        } catch {
          return false;
        }
      }, "This pattern isn't valid."),
    options: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    unit: z.string().trim().max(20).optional(),
  })
  .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max, {
    message: "The minimum can't be above the maximum.",
    path: ["min"],
  });

/** Turns a label into a stable machine key, such as "Warranty end" to "warranty_end" */
export function keyFromLabel(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  const start = /^[a-z]/.test(base) ? base : `f_${base}`;
  let key = start;
  for (let n = 2; taken.includes(key); n++) key = `${start}_${n}`;
  return key;
}

function valueSchema({ type, config, label }: FieldDef): z.ZodType {
  const bounded = (schema: z.ZodNumber) => {
    let next = schema;
    if (config.min !== undefined) next = next.min(config.min, `${label} must be at least ${config.min}.`);
    if (config.max !== undefined) next = next.max(config.max, `${label} must be at most ${config.max}.`);
    return next;
  };
  switch (type) {
    case "integer":
      return bounded(z.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`));
    case "decimal":
    case "currency":
      return bounded(z.number({ error: `${label} must be a number.` }));
    case "boolean":
      return z.boolean();
    case "date":
      return z.iso.date(`${label} must be a valid date.`);
    case "datetime":
      return z.iso.datetime({ local: true, error: `${label} must be a valid date and time.` });
    case "url":
      return z.url({ protocol: /^https?$/, error: `${label} must be a web link.` });
    case "email":
      return z.email(`${label} must be an email address.`);
    case "person":
      return z.uuid(`Choose a person for ${label}.`);
    case "select":
      return z.enum((config.options ?? []) as [string, ...string[]], { error: `Choose a value for ${label}.` });
    case "multi_select":
      return z.array(z.enum((config.options ?? []) as [string, ...string[]]));
    default: {
      let text = z.string().trim().max(type === "long_text" ? 5000 : 500);
      if (config.pattern) text = text.regex(new RegExp(config.pattern), `${label} isn't in the expected format.`);
      return text;
    }
  }
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** One schema for the form and the server, built from the category's columns */
export function buildAttributesSchema(fields: readonly FieldDef[]) {
  return z.record(z.string(), z.unknown()).transform((input, ctx) => {
    const output: Record<string, unknown> = {};
    for (const field of fields) {
      const value = input[field.key];
      if (isEmpty(value)) {
        if (field.config.required && field.type !== "boolean") {
          ctx.addIssue({ code: "custom", path: [field.key], message: `${field.label} is required.` });
        }
        continue;
      }
      const parsed = valueSchema(field).safeParse(value);
      if (parsed.success) output[field.key] = parsed.data;
      else ctx.addIssue({ code: "custom", path: [field.key], message: parsed.error.issues[0].message });
    }
    return output;
  });
}

/** Explains why a column change would break existing data, or returns null if it's safe. */
export function fieldChangeProblem(before: FieldDef, after: FieldConfig, usedValues: readonly unknown[]): string | null {
  if (isChoice(before.type) && after.options) {
    const allowed = new Set(after.options);
    const missing = new Set(usedValues.flat().filter((value) => !allowed.has(value as string)));
    if (missing.size > 0) {
      return `Items still use: ${[...missing].slice(0, 5).join(", ")}. Change those items first.`;
    }
  }
  if (isNumeric(before.type)) {
    const numbers = usedValues.filter((value): value is number => typeof value === "number");
    if (after.min !== undefined && numbers.some((value) => value < after.min!)) {
      return "Some items are below this minimum. Change those items first.";
    }
    if (after.max !== undefined && numbers.some((value) => value > after.max!)) {
      return "Some items are above this maximum. Change those items first.";
    }
  }
  return null;
}
