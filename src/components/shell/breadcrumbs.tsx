"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  records: "Records",
  categories: "Categories",
  transfers: "Transfers",
  assignments: "Assignments",
  predictions: "Predictions",
  assistant: "Assistant",
  accounts: "Accounts",
  offices: "Offices",
  permissions: "Permissions",
  system: "System health",
  monitor: "Live monitor",
  logs: "Logs",
  announcements: "Announcements",
  notifications: "Notifications",
  access: "My access",
  profile: "Profile",
  settings: "Settings",
  new: "New",
  columns: "Edit columns",
  edit: "Edit",
};

const isId = (segment: string) => /^[0-9a-f-]{36}$/.test(segment);

export function crumbsFor(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments
    .map((segment, index) => ({
      label: isId(segment) ? "Details" : LABELS[segment],
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }))
    // "console" only groups Developer pages, and has no page of its own.
    .filter((crumb) => crumb.label);
  // Every trail starts at the dashboard.
  return segments[0] === "dashboard" ? crumbs : [{ label: LABELS.dashboard, href: "/dashboard" }, ...crumbs];
}

/** The back button and trail at the top of a page's content. The dashboard is home, so it has neither. */
export function PageTrail() {
  const crumbs = crumbsFor(usePathname());
  const parent = crumbs.at(-2);
  if (!parent) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={parent.href} aria-label={`Back to ${parent.label}`} title={`Back to ${parent.label}`}>
          <ArrowLeft aria-hidden />
          Back
        </Link>
      </Button>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={crumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
