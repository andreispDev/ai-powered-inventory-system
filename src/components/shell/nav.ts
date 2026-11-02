import {
  Activity,
  ArrowLeftRight,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Cpu,
  FolderTree,
  Gauge,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  ScrollText,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import type { Permission } from "@/server/authz/catalog";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Pages from later phases have no href yet and show as "Soon" */
  href?: string;
  permission?: Permission;
};

export type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Offices", icon: Building2, href: "/console/offices", permission: "office.manage" },
      { label: "Inventory", icon: Boxes, href: "/inventory", permission: "item.read" },
      { label: "Categories", icon: FolderTree, href: "/categories", permission: "category.read" },
      { label: "Transfers", icon: ArrowLeftRight, href: "/transfers", permission: "transfer.create" },
      { label: "Transfers", icon: ArrowLeftRight, href: "/transfers", permission: "transfer.respond" },
      { label: "Transfers", icon: ArrowLeftRight, href: "/transfers", permission: "monitor.all" },
      { label: "Assignments", icon: UserCheck, href: "/assignments", permission: "assignment.manage" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Predictions", icon: TrendingUp, href: "/predictions", permission: "ai.forecast.read" },
      { label: "Assistant", icon: MessageSquare, href: "/assistant", permission: "ai.chat" },
    ],
  },
  {
    label: "Oversight",
    items: [
      { label: "Accounts", icon: Users, href: "/accounts", permission: "user.read" },
      { label: "Permissions", icon: KeyRound, href: "/console/permissions", permission: "permission.grant" },
      { label: "My access", icon: KeyRound, href: "/access", permission: "access.request" },
      { label: "Live monitor", icon: Activity, href: "/monitor", permission: "monitor.office" },
      { label: "Live monitor", icon: Activity, href: "/monitor", permission: "monitor.all" },
      { label: "Logs", icon: ScrollText, href: "/logs", permission: "audit.read.all" },
      { label: "Logs", icon: ScrollText, href: "/logs", permission: "audit.read.office" },
      { label: "My activity", icon: ClipboardList, href: "/logs?mine=1", permission: "audit.read.own" },
      { label: "Announcements", icon: Megaphone, href: "/announcements", permission: "announce.office" },
      { label: "Announcements", icon: Megaphone, href: "/announcements", permission: "announce.all" },
      { label: "Notifications", icon: Bell, href: "/notifications" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Health", icon: Gauge, href: "/console/system", permission: "monitor.all" },
      { label: "AI usage", icon: Cpu, permission: "monitor.all" },
    ],
  },
];

/** Follows effective permissions, so a new grant adds its pages automatically. */
export function navFor(permissions: readonly Permission[]): NavGroup[] {
  return NAV.map((group) => {
    const seen = new Set<string>();
    const items = group.items.filter((item) => {
      if (item.permission && !permissions.includes(item.permission)) return false;
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
    return { ...group, items };
  }).filter((group) => group.items.length > 0);
}
