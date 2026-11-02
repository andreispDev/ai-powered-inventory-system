"use client";

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

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  categories: "Categories",
  transfers: "Transfers",
  assignments: "Assignments",
  predictions: "Predictions",
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
  edit: "Edit",
};

const isId = (segment: string) => /^[0-9a-f-]{36}$/.test(segment);

export function crumbsFor(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments
      .map((segment, index) => ({
        label: isId(segment) ? "Details" : LABELS[segment],
        href: `/${segments.slice(0, index + 1).join("/")}`,
      }))
      // "console" only groups Developer pages, and has no page of its own.
      .filter((crumb) => crumb.label)
  );
}

export function Breadcrumbs() {
  const crumbs = crumbsFor(usePathname());

  if (crumbs.length === 0) return null;
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {/* Phones show only the current page, next to the back button. */}
            {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
            <BreadcrumbItem className={index === crumbs.length - 1 ? undefined : "hidden md:inline-flex"}>
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
  );
}
