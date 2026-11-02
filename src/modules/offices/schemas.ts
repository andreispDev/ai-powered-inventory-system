import { z } from "zod";

const optional = z
  .string()
  .trim()
  .max(300)
  .transform((value) => value || null)
  .nullable()
  .optional();

export const officeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, "Use 2–12 letters, numbers or dashes."),
  name: z.string().trim().min(2, "Enter the office name.").max(120),
  address: optional,
  contactEmail: z
    .union([z.literal(""), z.email("Enter a valid email address.")])
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

export type OfficeInput = z.input<typeof officeSchema>;
