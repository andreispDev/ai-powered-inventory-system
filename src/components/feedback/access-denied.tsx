import { ShieldX } from "lucide-react";
import { EmptyState, PageContainer } from "@/components/shell/page";

export function AccessDenied() {
  return (
    <PageContainer width="narrow">
      <EmptyState
        icon={ShieldX}
        title="You don't have access to this page"
        description="If you need it for your work, ask your administrator to grant you access."
      />
    </PageContainer>
  );
}
