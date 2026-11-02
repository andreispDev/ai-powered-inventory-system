// Background worker. Runs apart from the web app: npm run dev:worker
import { Queue, Worker } from "bullmq";
import { asc, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Redis from "ioredis";
import { Pool } from "pg";
import * as schema from "../server/db/schema";
import { jobRun, outbox } from "../server/db/schema";
import { runScoped, type ScopedTx } from "../server/db/scope";
import { JOBS, QUEUE, WORKER_HEARTBEAT_KEY } from "../server/queue/names";
import {
  checkpointAudit,
  dispatchAnnouncements,
  handleEvent,
  scanReminders,
  verifyAudit,
} from "./events";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const db = drizzle(new Pool({ connectionString: required("DATABASE_URL"), max: 5 }), { schema });
const redisUrl = required("REDIS_URL");
const prefix = process.env.QUEUE_PREFIX ?? "inventory";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
redis.on("error", (error) => console.error("Redis:", error.message));
const connection = { url: redisUrl };

const WORKER_ID = "00000000-0000-4000-8000-000000000000";
const STREAM_LENGTH = 10_000;

/** Platform scope plus the worker flag, the only way to create notifications. */
const asWorker = <T>(fn: (tx: ScopedTx) => Promise<T>) =>
  runScoped(db, { kind: "platform", userId: WORKER_ID }, async (tx) => {
    await tx.execute(sql`select set_config('app.worker', 'on', true)`);
    return fn(tx);
  });

async function publish(stream: string, type: string, data: unknown) {
  await redis.xadd(stream, "MAXLEN", "~", STREAM_LENGTH, "*", "type", type, "data", JSON.stringify(data));
}

async function alertPeople(userIds: string[]) {
  await Promise.all(userIds.map((id) => publish(`events:user:${id}`, "notification", {})));
}

/** Publishes committed events. Everything stays in the outbox until this succeeds. */
async function relayOnce(): Promise<number> {
  const { handled, toAlert, activity } = await asWorker(async (tx) => {
    const events = await tx
      .select()
      .from(outbox)
      .where(isNull(outbox.publishedAt))
      .orderBy(asc(outbox.createdAt))
      .limit(100)
      .for("update", { skipLocked: true });
    const toAlert: string[] = [];
    for (const event of events) {
      toAlert.push(
        ...(await handleEvent(tx, {
          id: event.id,
          topic: event.topic,
          payload: event.payload as Record<string, unknown>,
        })),
      );
    }
    if (events.length > 0) {
      await tx.execute(
        sql`update outbox set published_at = now() where id in (${sql.join(
          events.map((event) => sql`${event.id}::uuid`),
          sql`, `,
        )})`,
      );
    }
    return { handled: events.length, toAlert, activity: events.filter((event) => event.topic === "activity") };
  });

  // After commit, so nobody hears about a change that rolled back. A lost alert only means a later refresh.
  await alertPeople([...new Set(toAlert)]);
  for (const event of activity) {
    await publish("events:platform", "activity", event.payload);
    if (event.officeId) await publish(`events:office:${event.officeId}`, "activity", event.payload);
  }
  return handled;
}

let stopping = false;

async function relayLoop() {
  while (!stopping) {
    let handled = 0;
    try {
      handled = await relayOnce();
    } catch (error) {
      console.error("Outbox relay:", error);
    }
    if (handled === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const recordRun = async (name: string, status: string, durationMs: number, error?: string) => {
  await asWorker((tx) => tx.insert(jobRun).values({ queue: QUEUE, name, status, durationMs, error })).catch((e) =>
    console.error("Couldn't record job run:", e),
  );
};

const HANDLERS: Record<string, () => Promise<void>> = {
  [JOBS.announcements]: async () => {
    const sent = await asWorker(dispatchAnnouncements);
    await alertPeople([...new Set([...sent.values()].flat())]);
  },
  [JOBS.reminders]: async () => alertPeople([...new Set(await asWorker((tx) => scanReminders(tx)))]),
  [JOBS.auditCheckpoint]: async () => {
    await asWorker(checkpointAudit);
  },
  [JOBS.auditVerify]: async () => {
    const result = await asWorker(verifyAudit);
    await alertPeople(result.alerted);
    if (!result.ok) throw new Error(`Audit chain broken at ${result.brokenAt}`);
  },
};

const queue = new Queue(QUEUE, { connection, prefix });

const worker = new Worker(
  QUEUE,
  async (job) => {
    const handler = HANDLERS[job.name];
    if (!handler) throw new Error(`Unknown job ${job.name}`);
    const started = Date.now();
    try {
      await handler();
      await recordRun(job.name, "completed", Date.now() - started);
    } catch (error) {
      await recordRun(job.name, "failed", Date.now() - started, String(error).slice(0, 500));
      throw error;
    }
  },
  { connection, prefix, concurrency: 2 },
);
worker.on("error", (error) => console.error("Queue:", error.message));

const defaults = { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 };

async function main() {
  // Only one instance fires each schedule, however many workers run.
  await queue.upsertJobScheduler("announcements", { every: 60_000 }, { name: JOBS.announcements, opts: defaults });
  await queue.upsertJobScheduler("reminders", { every: 3_600_000 }, { name: JOBS.reminders, opts: defaults });
  await queue.upsertJobScheduler("audit-checkpoint", { every: 600_000 }, { name: JOBS.auditCheckpoint, opts: defaults });
  await queue.upsertJobScheduler("audit-verify", { pattern: "0 2 * * *" }, { name: JOBS.auditVerify, opts: defaults });
  await queue.add(JOBS.auditCheckpoint, {}, defaults);

  const heartbeat = () => redis.set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), "EX", 60).catch(() => {});
  void heartbeat();
  const beat = setInterval(heartbeat, 15_000);

  const relay = relayLoop();
  console.log("Worker running.");

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log("Worker stopping…");
    clearInterval(beat);
    await relay;
    await worker.close();
    await queue.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main();
