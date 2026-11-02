import { eq } from "drizzle-orm";
import { z } from "zod";
import { getActor } from "@/server/auth/session";
import { officeBranding, userAvatar } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

/** Serves logos and profile photos. RLS decides who can see them, so others get "not found". */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });

  const { kind, id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const image = await readScoped(actor, async (tx) => {
    if (kind === "logo") {
      const [row] = await tx.select({ bytes: officeBranding.logo, type: officeBranding.logoType }).from(officeBranding).where(eq(officeBranding.officeId, id));
      return row;
    }
    if (kind === "avatar") {
      const [row] = await tx.select({ bytes: userAvatar.image, type: userAvatar.imageType }).from(userAvatar).where(eq(userAvatar.userId, id));
      return row;
    }
    return undefined;
  });
  if (!image?.bytes || !image.type) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "X-Content-Type-Options": "nosniff",
      // URLs carry a version, so a changed image is fetched fresh.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
