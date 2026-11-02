"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { crumbsFor } from "./breadcrumbs";

/** Goes up one level, shown on any page below a top-level one. */
export function BackButton() {
  const crumbs = crumbsFor(usePathname());
  const parent = crumbs.at(-2);
  if (!parent) return null;
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href={parent.href} aria-label={`Back to ${parent.label}`} title={`Back to ${parent.label}`}>
        <ArrowLeft aria-hidden />
      </Link>
    </Button>
  );
}
