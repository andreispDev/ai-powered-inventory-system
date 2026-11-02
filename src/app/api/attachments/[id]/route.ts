import { eq } from "drizzle-orm";
import { z } from "zod";
import { downloadHeader } from "@/modules/inventory/attachment-file";
import { writeAudit } from "@/server/audit/writer";
import { getActor } from "@/server/auth/session";
import { itemAttachment } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

/** Downloads a file. RLS decides who can see it, so others get "not found". */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!actor.permissions.includes("item.read")) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const file = await readScoped(actor, async (tx) => {
    const [row] = await tx.select().from(itemAttachment).where(eq(itemAttachment.id, id));
    // A Developer looking at office data is itself on the record.
    if (row && actor.role === "developer") {
      await writeAudit(tx, { actor, action: "platform.viewed", entityType: "item", entityId: row.itemId, officeId: row.officeId, after: { fileName: row.fileName } });
    }
    return row;
  });
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": downloadHeader(file.fileName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
