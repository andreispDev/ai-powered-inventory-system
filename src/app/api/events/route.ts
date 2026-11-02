import Redis from "ioredis";
import { actorFromHeaders } from "@/server/auth/session";
import { streamsFor } from "@/server/queue/names";

const MAX_CONNECTIONS_PER_USER = 10;
const SESSION_CHECK_MS = 60_000;
const BLOCK_MS = 20_000;

const open = new Map<string, number>();

const parseCursor = (raw: string | null): Record<string, string> => {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    return {};
  }
};

/** Live events for one person. The server picks the channels from the session, never the client. */
export async function GET(request: Request) {
  const actor = await actorFromHeaders(request.headers);
  if (!actor) return new Response("Unauthorized", { status: 401 });

  const url = process.env.REDIS_URL;
  if (!url) return new Response("Unavailable", { status: 503 });

  const count = open.get(actor.id) ?? 0;
  if (count >= MAX_CONNECTIONS_PER_USER) return new Response("Too many connections", { status: 429 });
  open.set(actor.id, count + 1);

  const seesActivity = actor.permissions.includes("monitor.all") || actor.permissions.includes("monitor.office");
  const streams = streamsFor({ userId: actor.id, officeId: actor.officeId });
  const presenceKeys = ["presence:all", ...(actor.officeId ? [`presence:office:${actor.officeId}`] : [])];
  const requestHeaders = new Headers(request.headers);
  const encoder = new TextEncoder();

  const redis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
  redis.on("error", () => {});
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    redis.disconnect();
    const remaining = (open.get(actor.id) ?? 1) - 1;
    if (remaining <= 0) open.delete(actor.id);
    else open.set(actor.id, remaining);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      request.signal.addEventListener("abort", () => {
        close();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });

      try {
        await redis.connect();

        // Resume from the last event the browser saw, or start from now.
        const cursor = parseCursor(request.headers.get("last-event-id"));
        for (const key of streams) {
          if (cursor[key]) continue;
          const latest = await redis.xrevrange(key, "+", "-", "COUNT", 1);
          cursor[key] = latest[0]?.[0] ?? "0-0";
        }

        send("retry: 3000\n\n");
        let lastSessionCheck = Date.now();

        while (!closed) {
          await Promise.all(presenceKeys.map((key) => redis.zadd(key, Date.now(), actor.id)));

          if (Date.now() - lastSessionCheck > SESSION_CHECK_MS) {
            lastSessionCheck = Date.now();
            if (!(await actorFromHeaders(requestHeaders))) {
              send("event: session-ended\ndata: {}\n\n");
              break;
            }
          }

          const result = (await redis.xread(
            "COUNT",
            50,
            "BLOCK",
            BLOCK_MS,
            "STREAMS",
            ...streams,
            ...streams.map((key) => cursor[key]),
          )) as [string, [string, string[]][]][] | null;

          if (!result) {
            send(": keep-alive\n\n");
            continue;
          }
          for (const [key, entries] of result) {
            for (const [entryId, fields] of entries) {
              cursor[key] = entryId;
              const type = fields[fields.indexOf("type") + 1];
              const data = fields[fields.indexOf("data") + 1];
              if (type === "activity" && !seesActivity) continue;
              const id = Buffer.from(JSON.stringify(cursor)).toString("base64url");
              send(`id: ${id}\nevent: ${type}\ndata: ${data}\n\n`);
            }
          }
        }
      } catch {
        // Redis went away or the browser left. EventSource reconnects and resumes on its own.
      } finally {
        close();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel: close,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
