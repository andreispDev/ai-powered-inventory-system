"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IDLE_MINUTES, MIN_IDLE_MINUTES } from "@/server/auth/idle";
import { systemSetting } from "@/server/db/schema";
import { guard } from "@/server/guard/guard";

export const setIdleMinutes = guard({
  permission: "system.configure",
  input: z.object({
    minutes: z
      .number("Enter a number of minutes.")
      .int("Enter a whole number of minutes.")
      .min(MIN_IDLE_MINUTES, `Enter at least ${MIN_IDLE_MINUTES} minute.`)
      .max(MAX_IDLE_MINUTES, `Enter at most ${MAX_IDLE_MINUTES} minutes.`),
  }),
  run: async ({ input: { minutes }, tx, audit }) => {
    const [before] = await tx.select({ minutes: systemSetting.idleMinutes }).from(systemSetting);
    await tx.update(systemSetting).set({ idleMinutes: minutes }).where(eq(systemSetting.id, 1));
    await audit({ action: "system.idle_changed", entityType: "system_setting", officeId: null, before: { minutes: before?.minutes }, after: { minutes } });
    revalidatePath("/settings");
    return { minutes };
  },
});
