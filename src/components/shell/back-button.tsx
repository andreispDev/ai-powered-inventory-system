"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { crumbsFor } from "./breadcrumbs";

/** Goes up one level, shown everywhere except the dashboard. */
export function BackButton() {
  const crumbs = crumbsFor(usePathname());
  const parent = crumbs.at(-2);
  if (!parent) return null;
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={parent.href} aria-label={`Back to ${parent.label}`} title={`Back to ${parent.label}`}>
        <ArrowLeft aria-hidden />
        <span className="hidden sm:inline">Back</span>
      </Link>
    </Button>
  );
}
