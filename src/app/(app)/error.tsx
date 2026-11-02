"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState, PageContainer } from "@/components/shell/page";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <PageContainer width="narrow">
      <EmptyState
        icon={TriangleAlert}
        title="This page couldn't load"
        description={error.digest ? `Please try again. Reference: ${error.digest}` : "Please try again."}
      />
      <div className="text-center">
        <Button onClick={reset}>Try again</Button>
      </div>
    </PageContainer>
  );
}
