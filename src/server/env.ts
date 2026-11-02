import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.url(),
    DATABASE_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    SMTP_USER: z.email().optional(),
    SMTP_APP_PASSWORD: z.string().min(1).optional(),
  })
  .refine(
    (value) => process.env.NODE_ENV !== "production" || (value.SMTP_USER && value.SMTP_APP_PASSWORD),
    { message: "SMTP_USER and SMTP_APP_PASSWORD are required in production" },
  );

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

export function env(): Env {
  return (parsed ??= schema.parse(process.env));
}

export function isConfigured() {
  return schema.safeParse(process.env).success;
}
