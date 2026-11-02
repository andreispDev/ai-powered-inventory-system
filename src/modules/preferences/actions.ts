"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { appUser } from "@/server/db/schema";
import { guard } from "@/server/guard/guard";

export const savePreferences = guard({
  permission: null,
  input: z.object({
    mode: z.enum(["light", "dark", "system"]),
    theme: z.string().max(20),
    scale: z.enum(["compact", "normal", "large"]),
    font: z.enum(["geist", "inter", "lato"]),
  }),
  run: async ({ input, tx, actor }) => {
    await tx.update(appUser).set({ preferences: input }).where(eq(appUser.id, actor.id));
  },
});
