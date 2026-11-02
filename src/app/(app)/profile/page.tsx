import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageSkeleton } from "@/components/shell/page";
import { MyPhotoControl } from "@/modules/accounts/my-photo";
import { loadProfileActivity, ProfilePhoto, ProfileView } from "@/modules/accounts/profile-view";
import { requireActor } from "@/server/auth/session";
import { appUser } from "@/server/db/schema";
import { readScoped } from "@/server/guard/read";

export const metadata: Metadata = { title: "Profile" };

async function Content() {
  const actor = await requireActor();
  const data = await readScoped(actor, async (tx) => {
    const [row] = await tx.select({ status: appUser.status, createdAt: appUser.createdAt }).from(appUser).where(eq(appUser.id, actor.id));
    return { row, activity: await loadProfileActivity(tx, actor.id) };
  });
  return (
    <PageContainer>
      <ProfileView
        name={actor.name}
        email={actor.email}
        role={actor.role}
        status={data.row.status}
        officeName={actor.officeName}
        memberSince={data.row.createdAt}
        permissionCount={actor.permissions.length}
        photo={<ProfilePhoto name={actor.name} url={actor.image} />}
        actions={<MyPhotoControl hasPhoto={!!actor.image} />}
        activity={data.activity}
      />
    </PageContainer>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
