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

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments
    .map((segment, index) => ({
      label: isId(segment) ? "Details" : LABELS[segment],
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }))
    // "console" only groups Developer pages, and has no page of its own.
    .filter((crumb) => crumb.label);

  if (crumbs.length === 0) return null;
  return (
    <Breadcrumb className="hidden min-w-0 md:block">
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
  );
}
