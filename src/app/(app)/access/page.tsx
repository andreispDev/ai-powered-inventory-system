import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/feedback/access-denied";
import { LocalTime } from "@/components/shell/local-time";
import { PageContainer, PageHeader, PageSkeleton } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestForm } from "@/modules/permissions/request-ui";
import { requireActor } from "@/server/auth/session";
import { canEverHold, PERMISSIONS } from "@/server/authz/catalog";
import { permissionRequest } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "My access" };

async function Content() {
  const actor = await requireActor();
  if (!actor.permissions.includes("access.request")) return <AccessDenied />;

  // RLS limits this to the person's own requests.
  const requests = await readScoped(actor, (tx) => tx.select().from(permissionRequest).orderBy(desc(permissionRequest.createdAt)).limit(30));
  const pending = new Set(requests.filter((r) => r.status === "pending").map((r) => r.permission));
  const available = PERMISSIONS.filter((p) => canEverHold(actor.role, p) && !actor.permissions.includes(p) && !pending.has(p));

  return (
    <PageContainer>
      <PageHeader title="My access" description="What you can do, and how to ask for more." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ask for access</CardTitle>
              <CardDescription>A Developer reviews your request, and you&apos;re notified of the answer.</CardDescription>
            </CardHeader>
            <CardContent>
              {available.length === 0 ? <p className="text-muted-foreground text-sm">There&apos;s nothing else to ask for.</p> : <RequestForm available={available} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-muted-foreground text-sm">No requests yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {requests.map((request) => (
                    <li key={request.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs">{request.permission}</span>
                        <span className="text-muted-foreground text-xs">
                          <LocalTime date={request.createdAt} />
                        </span>
                      </span>
                      <Badge className="capitalize" variant={request.status === "approved" ? "secondary" : "outline"}>
                        {request.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>What you can do now</CardTitle>
            <CardDescription>{actor.permissions.length} permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
              {actor.permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function AccessPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
