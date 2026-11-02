import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ALLOWED_HD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

export function env(): Env {
  return (parsed ??= schema.parse(process.env));
}

export function isConfigured() {
  return schema.safeParse(process.env).success;
}
