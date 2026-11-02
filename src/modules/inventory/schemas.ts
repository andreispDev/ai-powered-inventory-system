import { z } from "zod";

export const ITEM_STATUSES = [
  { value: "active", label: "Active" },
  { value: "in_repair", label: "In repair" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
] as const;

export const MOVEMENT_TYPES = [
  { value: "receive", label: "Receive", help: "Stock coming in" },
  { value: "issue", label: "Issue", help: "Stock going out" },
  { value: "return", label: "Return", help: "Stock coming back" },
  { value: "adjust", label: "Adjust", help: "Correct the count, up or down" },
] as const;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const day = z
  .union([z.literal(""), z.iso.date("Enter a valid date.")])
  .transform((value) => value || null)
  .nullable()
  .optional();

const wholeOrEmpty = z
  .union([z.literal(""), z.coerce.number().int("Enter a whole number.").min(0, "Can't be negative.")])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const itemCoreSchema = z.object({
  name: z.string().trim().min(1, "Enter the item name.").max(200),
  sku: text(80),
  status: z.enum(["active", "in_repair", "retired", "lost"]),
  unit: z.string().trim().min(1, "Enter a unit.").max(20),
  location: text(120),
  condition: text(60),
  serialNumber: text(120),
  supplier: text(120),
  unitCost: z
    .union([z.literal(""), z.coerce.number().min(0, "Can't be negative.").max(999_999_999_999)])
    .transform((value) => (value === "" ? null : String(value)))
    .nullable()
    .optional(),
  purchaseDate: day,
  warrantyExpiry: day,
  reorderLevel: wholeOrEmpty,
  notes: text(5000),
  attributes: z.record(z.string(), z.unknown()),
});

export type ItemCoreInput = z.input<typeof itemCoreSchema>;

export const movementSchema = z
  .object({
    itemId: z.uuid(),
    type: z.enum(["receive", "issue", "adjust", "return"]),
    amount: z.coerce.number().int("Enter a whole number.").min(-1_000_000).max(1_000_000),
    reason: z.string().trim().min(3, "Say why, so the history makes sense.").max(300),
  })
  .refine((m) => m.amount !== 0 && (m.type === "adjust" || m.amount > 0), {
    path: ["amount"],
    message: "Enter an amount above zero.",
  });

/** Issues remove stock, adjustments can go either way, and everything else adds. */
export function deltaOf(type: "receive" | "issue" | "adjust" | "return", amount: number): number {
  return type === "issue" ? -amount : amount;
}
