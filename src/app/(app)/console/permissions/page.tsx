import { asc, desc, eq, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageHeader, TableSkeleton } from "@/components/shell/page";
import { param, type SearchParams } from "@/lib/pagination";
import { PermissionMatrix, SubjectPicker, type MatrixRow } from "@/modules/permissions/permission-matrix";
import { requireActor } from "@/server/auth/session";
import { canEverHold, isAllowed, PERMISSIONS, roleDefault, type Role } from "@/server/authz/catalog";
import { DecideButtons } from "@/modules/permissions/request-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appUser, office, permissionGrant, permissionRequest } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Permissions" };

type Props = { searchParams: Promise<SearchParams> };

async function Content({ searchParams }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("permission.grant")) return <AccessDenied />;

  const params = await searchParams;
  const selected = param(params, "subject");
  const [type, id] = selected?.split(":") ?? [];
  const subjectType = type === "user" || type === "office" ? type : null;
  const subjectId = subjectType && z.uuid().safeParse(id).success ? id : null;

  const data = await readScoped(actor, async (tx) => {
    const offices = await tx.select({ id: office.id, name: office.name }).from(office).where(eq(office.status, "active")).orderBy(asc(office.name));
    const people = await tx
      .select({ id: appUser.id, name: appUser.name, role: appUser.role, officeId: appUser.officeId })
      .from(appUser)
      .where(sql`${appUser.officeId} is not null and ${appUser.status} <> 'deactivated'`)
      .orderBy(asc(appUser.name))
      .limit(500);
    const requests = await tx
      .select({
        id: permissionRequest.id,
        permission: permissionRequest.permission,
        justification: permissionRequest.justification,
        name: appUser.name,
        officeName: office.name,
      })
      .from(permissionRequest)
      .innerJoin(appUser, eq(permissionRequest.requesterId, appUser.id))
      .innerJoin(office, eq(permissionRequest.officeId, office.id))
      .where(eq(permissionRequest.status, "pending"))
      .orderBy(desc(permissionRequest.createdAt));
    if (!subjectId || !subjectType) return { offices, people, grants: [], requests };

    const person = subjectType === "user" ? people.find((p) => p.id === subjectId) : undefined;
    const grants = await tx
      .select()
      .from(permissionGrant)
      .where(person?.officeId ? or(eq(permissionGrant.subjectId, person.id), eq(permissionGrant.subjectId, person.officeId)) : eq(permissionGrant.subjectId, subjectId));
    return { offices, people, grants, person, requests };
  });

  const officeName = (officeId: string | null) => data.offices.find((o) => o.id === officeId)?.name ?? "";
  const options = [
    ...data.offices.map((o) => ({ value: `office:${o.id}`, label: `Office: ${o.name}`, group: "Offices" })),
    ...data.people.map((p) => ({ value: `user:${p.id}`, label: `${p.name} (${p.role}, ${officeName(p.officeId)})`, group: "People" })),
  ];

  let rows: MatrixRow[] = [];
  if (subjectType && subjectId) {
    const role: Role = data.person?.role ?? "admin";
    const now = new Date();
    rows = PERMISSIONS.filter((permission) => canEverHold(role, permission)).map((permission) => {
      const relevant = data.grants.filter((g) => g.permission === permission);
      const own = relevant.find((g) => g.subjectType === subjectType && g.subjectId === subjectId);
      const inherited = subjectType === "user" ? relevant.find((g) => g.subjectType === "office") : undefined;
      const active = (g: typeof own) => !!g && (!g.expiresAt || g.expiresAt > now);
      const why = active(own)
        ? `${subjectType === "user" ? "Person" : "Office"} rule: ${own!.reason}`
        : active(inherited)
          ? `Office rule: ${inherited!.reason}`
          : "Role default";
      return {
        permission,
        roleDefault: roleDefault(role, permission),
        effective: data.person ? isAllowed(role, permission, relevant, now) : active(own) ? own!.effect === "allow" : null,
        why,
        rule: own ? { effect: own.effect, reason: own.reason, expiresAt: own.expiresAt?.toISOString() ?? null, expired: !active(own) } : null,
      };
    });
  }

  return (
    <PageContainer width="wide">
      <PageHeader title="Permissions" description="Allow or deny a feature for an office or a person. A person's rule beats an office rule, and that beats the role's default." />
      {data.requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for your answer ({data.requests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.requests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{request.name}</span>
                    <span className="text-muted-foreground"> at {request.officeName} asked for </span>
                    <span className="font-mono text-xs">{request.permission}</span>
                    <span className="text-muted-foreground block text-xs">&ldquo;{request.justification}&rdquo;</span>
                  </span>
                  <DecideButtons id={request.id} summary={`${request.name} at ${request.officeName} asked for ${request.permission}.`} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <SubjectPicker options={options} value={selected ?? ""} />
      {subjectType && subjectId && (
        <PermissionMatrix rows={rows} subjectType={subjectType} subjectId={subjectId} showEffective={!!data.person} />
      )}
    </PageContainer>
  );
}

export default function PermissionsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
