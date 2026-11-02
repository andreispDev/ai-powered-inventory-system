import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WIDTHS = {
  narrow: "max-w-[var(--content-narrow)]",
  default: "max-w-[var(--content-default)]",
  wide: "max-w-[var(--content-wide)]",
};

export function PageContainer({
  width = "default",
  children,
}: {
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return <div className={cn("mx-auto w-full space-y-6", WIDTHS[width])}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A headline number. Links to the list behind it when there is one. */
export function StatCard({ label, value, icon: Icon, href }: { label: string; value: string; icon: LucideIcon; href?: string }) {
  const content = (
    <Card className={cn("surface-soft h-full", href && "hover:shadow-raised transition-shadow duration-[var(--motion-base)]")}>
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        </div>
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4.5" aria-hidden />
        </span>
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="surface-soft flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      <Icon className="text-muted-foreground mb-3 size-6" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full" aria-busy="true" aria-label="Loading">
      <div className="bg-sidebar hidden w-[15rem] space-y-3 border-r p-4 md:block">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="h-14 border-b" />
        <PageSkeleton />
      </div>
    </div>
  );
}

export function TableSkeleton({ width = "wide" }: { width?: keyof typeof WIDTHS }) {
  return (
    <PageContainer width={width}>
      <div aria-busy="true" aria-label="Loading" className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2 rounded-lg border p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[var(--content-default)] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
