import { Queue } from "bullmq";
import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, CircleCheck, CircleX, History, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/server/auth/session";
import { jobRun, outbox } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";
import { QUEUE, WORKER_HEARTBEAT_KEY } from "@/server/queue/names";
import { withRedis } from "@/server/rate-limit";

export const metadata: Metadata = { title: "System health" };

function Status({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <Card className="surface-soft">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className={`size-4 ${ok ? "text-success" : "text-destructive"}`} aria-hidden />
          {label}
        </CardDescription>
        <CardTitle icon={ok ? CheckCircle2 : AlertTriangle}>{ok ? "Working" : "Problem"}</CardTitle>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </CardHeader>
    </Card>
  );
}

async function queueCounts() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const queue = new Queue(QUEUE, { connection: { url, maxRetriesPerRequest: 1, retryStrategy: () => null }, prefix: process.env.QUEUE_PREFIX ?? "inventory" });
  queue.on("error", () => {});
  try {
    return await Promise.race([
      queue.getJobCounts("waiting", "active", "delayed", "failed"),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
  } catch {
    return null;
  } finally {
    void queue.close().catch(() => {});
  }
}

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("monitor.all")) return <AccessDenied />;

  const db = await readScoped(actor, async (tx) => {
    const [pending] = await tx
      .select({
        total: count(),
        lagSeconds: sql<number>`coalesce(extract(epoch from now() - min(${outbox.createdAt})), 0)::int`,
      })
      .from(outbox)
      .where(isNull(outbox.publishedAt));
    const runs = await tx.select().from(jobRun).orderBy(desc(jobRun.at)).limit(15);
    const [failures] = await tx.select({ total: count() }).from(jobRun).where(eq(jobRun.status, "failed"));
    return { pending, runs, failures: failures.total };
  });

  const redis = await withRedis(async (client) => ({
    pong: await client.ping(),
    heartbeat: await client.get(WORKER_HEARTBEAT_KEY),
  }));
  const counts = await queueCounts();

  const lagSeconds = db.pending.lagSeconds;
  const workerUp = !!redis?.heartbeat;

  return (
    <PageContainer>
      <PageHeader title="System health" description="Refresh the page to update these." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Status label="Database" ok detail="Answering requests." />
        <Status label="Redis" ok={redis?.pong === "PONG"} detail={redis ? "Limits and live updates are available." : "Live updates are paused. Rate limits fall back to each server."} />
        <Status label="Worker" ok={workerUp} detail={workerUp ? "Running." : "Not running. Notifications wait until it's back, and nothing is lost."} />
        <Status label="Event delivery" ok={lagSeconds < 60} detail={db.pending.total === 0 ? "Nothing waiting." : `${db.pending.total} waiting, oldest ${lagSeconds}s.`} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle icon={ListChecks}>Job queue</CardTitle>
          </CardHeader>
          <CardContent>
            {counts ? (
              <dl className="divide-y text-sm">
                {Object.entries(counts).map(([name, value]) => (
                  <div key={name} className="flex justify-between py-2">
                    <dt className="text-muted-foreground capitalize">{name}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">Unavailable without Redis.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle icon={History}>Recent jobs</CardTitle>
            <CardDescription>{db.failures} failed in total</CardDescription>
          </CardHeader>
          <CardContent>
            {db.runs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No jobs have run yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {db.runs.map((run) => (
                  <li key={run.id.toString()} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-xs">{run.name}</span>
                      {run.error && <span className="text-destructive block truncate text-xs">{run.error}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                      <span className="text-muted-foreground">
                        <LocalTime date={run.at} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function SystemPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
