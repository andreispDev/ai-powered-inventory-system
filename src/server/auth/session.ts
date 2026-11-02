import "server-only";
import { eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { effectivePermissions, type Permission, type Role } from "../authz/catalog";
import { getAuthDb } from "../db/client";
import { appUser, office, officeBranding, permissionGrant, userAvatar } from "../db/schema";
import { isConfigured } from "../env";
import { getAuth } from "./config";
import { isPastAbsoluteLimit } from "./sign-in-rules";

export type Actor = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  officeId: string | null;
  officeName: string | null;
  /** The office's chosen name for the app, if it set one */
  workspaceName: string | null;
  logoUrl: string | null;
  permissions: Permission[];
  preferences: Record<string, unknown> | null;
};

/** Loaded fresh on every request, so revoked access ends immediately. Memoized within one render. */
export const getActor = cache(async (): Promise<Actor | null> => actorFromHeaders(await headers()));

/** For long-lived connections, which must recheck the session as time passes. */
export async function actorFromHeaders(requestHeaders: Headers): Promise<Actor | null> {
  if (!isConfigured()) return null;

  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result || isPastAbsoluteLimit(result.session.createdAt)) return null;

  const db = getAuthDb();
  const [row] = await db
    .select({
      user: appUser,
      officeName: office.name,
      workspaceName: officeBranding.workspaceName,
      logoType: officeBranding.logoType,
      brandingAt: officeBranding.updatedAt,
      photoAt: userAvatar.updatedAt,
    })
    .from(appUser)
    .leftJoin(office, eq(appUser.officeId, office.id))
    .leftJoin(officeBranding, eq(officeBranding.officeId, appUser.officeId))
    .leftJoin(userAvatar, eq(userAvatar.userId, appUser.id))
    .where(eq(appUser.id, result.user.id));
  if (!row || row.user.status === "deactivated") return null;

  const { user } = row;
  const grants = await db
    .select()
    .from(permissionGrant)
    .where(
      user.officeId
        ? or(eq(permissionGrant.subjectId, user.id), eq(permissionGrant.subjectId, user.officeId))
        : eq(permissionGrant.subjectId, user.id),
    );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: row.photoAt ? `/api/images/avatar/${user.id}?v=${row.photoAt.getTime()}` : null,
    role: user.role,
    officeId: user.officeId,
    officeName: row.officeName,
    workspaceName: row.workspaceName,
    logoUrl: row.logoType && row.brandingAt ? `/api/images/logo/${user.officeId}?v=${row.brandingAt.getTime()}` : null,
    permissions: effectivePermissions(user.role, grants),
    preferences: user.preferences,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export function scopeOf(actor: Actor) {
  return actor.officeId
    ? ({ kind: "office", officeId: actor.officeId, userId: actor.id } as const)
    : ({ kind: "platform", userId: actor.id } as const);
}
