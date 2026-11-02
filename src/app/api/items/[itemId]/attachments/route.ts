import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAttachment, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_RECORD } from "@/modules/inventory/attachment-file";
import { writeAudit } from "@/server/audit/writer";
import { actorFromHeaders, scopeOf } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { category, item, itemAttachment } from "@/server/db/schema";
import { runScoped } from "@/server/db/scope";
import { checkLimit } from "@/server/rate-limit";

const fail = (status: number, message: string) => Response.json({ message }, { status });

/** Uploads one file. Not a server action, because those are limited to about 1 MB. */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return fail(403, "This request isn't allowed.");

  const actor = await actorFromHeaders(request.headers);
  if (!actor) return fail(401, "Sign in again.");
  if (!actor.permissions.includes("item.update")) return fail(403, "You don't have permission to do that.");
  if (!actor.officeId) return fail(403, "Changes are made by office accounts.");
  const officeId = actor.officeId;

  const { itemId } = await params;
  if (!z.uuid().safeParse(itemId).success) return fail(404, "This record no longer exists.");

  const limit = await checkLimit("write", actor.id);
  if (!limit.ok) return fail(429, "Too many requests. Please wait a moment.");

  // Refused before reading it, with some room for the form's own overhead.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) return fail(413, "That file is over the 10 MB limit.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "Choose a file to upload.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = checkAttachment(file.name, bytes);
  if ("error" in checked) return fail(400, checked.error);

  const outcome = await runScoped(getDb(), scopeOf(actor), async (tx) => {
    // RLS hides other offices' records, so they look like records that don't exist.
    const [record] = await tx
      .select({ kind: category.kind })
      .from(item)
      .innerJoin(category, eq(item.categoryId, category.id))
      .where(and(eq(item.id, itemId), isNull(item.deletedAt)));
    if (!record) return { status: 404, message: "This record no longer exists." };
    if (record.kind !== "records") return { status: 409, message: "Files can only be attached to records." };

    const [{ attached }] = await tx.select({ attached: count() }).from(itemAttachment).where(eq(itemAttachment.itemId, itemId));
    if (attached >= MAX_ATTACHMENTS_PER_RECORD) return { status: 409, message: `A record can hold up to ${MAX_ATTACHMENTS_PER_RECORD} files.` };

    const [row] = await tx
      .insert(itemAttachment)
      .values({ officeId, itemId, fileName: checked.name, contentType: checked.type, sizeBytes: bytes.length, data: bytes, uploadedBy: actor.id })
      .returning({ id: itemAttachment.id });
    await writeAudit(tx, {
      actor,
      action: "item.file_added",
      entityType: "item",
      entityId: itemId,
      after: { attachmentId: row.id, fileName: checked.name, sizeBytes: bytes.length },
    });
    return { status: 201, id: row.id };
  });
  if ("message" in outcome) return fail(outcome.status, outcome.message ?? "");

  revalidatePath(`/records/${itemId}`);
  return Response.json({ id: outcome.id }, { status: 201 });
}
