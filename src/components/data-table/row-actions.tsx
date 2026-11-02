import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** The last cell's contents in a table row. */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

export function RowLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>
        <Icon aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
