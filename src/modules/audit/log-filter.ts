import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { param, type SearchParams } from "@/lib/pagination";
import type { Permission } from "@/server/authz/catalog";
import { appUser, auditLog } from "@/server/db/schema";

export const ACTION_GROUPS = [
  { value: "item.", label: "Items" },
  { value: "stock.", label: "Stock" },
  { value: "category", label: "Categories" },
  { value: "transfer.", label: "Transfers" },
  { value: "assignment.", label: "Assignments" },
  { value: "user.", label: "Accounts" },
  { value: "office.", label: "Offices" },
  { value: "permission.", label: "Permissions" },
  { value: "announcement.", label: "Announcements" },
  { value: "auth.", label: "Sign-ins" },
  { value: "platform.", label: "Developer views" },
];

const validDay = (value: string | undefined) => (value && z.iso.date().safeParse(value).success ? value : undefined);

/** The filters on the Logs page. RLS limits rows to the office, and this narrows Users to their own actions. */
export function logWhere(params: SearchParams, actor: { id: string; permissions: readonly Permission[] }) {
  const can = (permission: Permission) => actor.permissions.includes(permission);
  const seesOthers = can("audit.read.all") || can("audit.read.office");
  const onlyMine = !seesOthers || param(params, "mine") === "1";
  const q = param(params, "q")?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const group = ACTION_GROUPS.find((g) => g.value === param(params, "action"))?.value;
  const from = validDay(param(params, "from"));
  const to = validDay(param(params, "to"));
  const officeFilter = can("audit.read.all") ? param(params, "office") : undefined;
  return and(
    onlyMine ? eq(auditLog.actorId, actor.id) : undefined,
    like ? or(ilike(appUser.name, like), ilike(auditLog.action, like), ilike(auditLog.entityId, like)) : undefined,
    group ? sql`${auditLog.action} like ${`${group}%`}` : undefined,
    from ? gte(auditLog.at, new Date(`${from}T00:00:00`)) : undefined,
    to ? lte(auditLog.at, new Date(`${to}T23:59:59.999`)) : undefined,
    officeFilter && z.uuid().safeParse(officeFilter).success ? eq(auditLog.officeId, officeFilter) : undefined,
  );
}
