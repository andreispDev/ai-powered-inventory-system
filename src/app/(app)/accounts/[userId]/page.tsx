import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PageContainer, PageSkeleton } from "@/components/shell/page";
import { loadProfileActivity, ProfilePhoto, ProfileView } from "@/modules/accounts/profile-view";
import { EditAccountButton } from "@/modules/accounts/edit-account-dialog";
import { AccountStatusButton } from "@/modules/accounts/status-button";
import { requireActor } from "@/server/auth/session";
import { effectivePermissions, type Role } from "@/server/authz/catalog";
import { appUser, office, permissionGrant, userAvatar } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Account" };

type Props = { params: Promise<{ userId: string }> };

async function Content({ params }: Props) {
  const actor = await requireActor();
  if (!actor.permissions.includes("user.read")) return <AccessDenied />;
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();

  const data = await readScoped(actor, async (tx) => {
    // RLS hides people in other offices, so they look like records that don't exist.
    const [row] = await tx
      .select({ user: appUser, officeName: office.name, photoAt: userAvatar.updatedAt })
      .from(appUser)
      .leftJoin(office, eq(appUser.officeId, office.id))
      .leftJoin(userAvatar, eq(userAvatar.userId, appUser.id))
      .where(eq(appUser.id, userId));
    if (!row) return null;
    const grants = await tx.select().from(permissionGrant);
    const relevant = grants.filter((g) => g.subjectId === userId || g.subjectId === row.user.officeId);
    return { ...row, relevant, activity: await loadProfileActivity(tx, userId) };
  });
  if (!data) notFound();

  const { user } = data;
  const canChange = actor.permissions.includes("user.manage") && user.id !== actor.id && (user.role === "user" || actor.role === "developer");
  const photoUrl = data.photoAt ? `/api/images/avatar/${user.id}?v=${data.photoAt.getTime()}` : null;

  return (
    <PageContainer>
      <ProfileView
        name={user.name}
        email={user.email}
        role={user.role}
        status={user.status}
        officeName={data.officeName}
        memberSince={user.createdAt}
        permissionCount={effectivePermissions(user.role as Role, data.relevant).length}
        photo={<ProfilePhoto name={user.name} url={photoUrl} />}
        actions={
          canChange ? (
            <div className="flex flex-wrap gap-2">
              <EditAccountButton id={user.id} name={user.name} email={user.email} />
              <AccountStatusButton id={user.id} name={user.name} active={user.status !== "deactivated"} />
            </div>
          ) : undefined
        }
        activity={data.activity}
      />
    </PageContainer>
  );
}

export default function AccountPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
