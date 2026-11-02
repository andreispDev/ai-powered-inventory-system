export type Role = "developer" | "admin" | "user";

const RANK: Record<Role, number> = { user: 0, admin: 1, developer: 2 };

type Entry = {
  /** Roles that have this permission unless a grant says otherwise */
  defaults: readonly Role[];
  /** The lowest role that can ever hold it, even through a grant */
  minRole: Role;
};

const entry = (defaults: readonly Role[], minRole: Role = "user"): Entry => ({ defaults, minRole });

export const CATALOG = {
  "item.read": entry(["developer", "admin", "user"]),
  "item.create": entry(["user"]),
  "item.update": entry(["user"]),
  "item.delete": entry(["user"]),
  "item.restore": entry(["admin"], "admin"),
  "stock.move": entry(["user"]),
  "category.read": entry(["developer", "admin", "user"]),
  "category.create": entry(["user"]),
  "category.update": entry(["user"]),
  "category.archive": entry(["admin"], "admin"),
  "assignment.manage": entry(["admin", "user"]),
  "transfer.create": entry(["admin"]),
  "transfer.respond": entry(["admin"], "admin"),
  "user.read": entry(["developer", "admin"], "admin"),
  "user.create": entry(["developer", "admin"], "admin"),
  "user.manage": entry(["developer", "admin"], "admin"),
  "admin.create": entry(["developer"], "developer"),
  "office.manage": entry(["developer"], "developer"),
  "permission.grant": entry(["developer"], "developer"),
  "audit.read.all": entry(["developer"], "developer"),
  "monitor.all": entry(["developer"], "developer"),
  "announce.all": entry(["developer"], "developer"),
  "audit.read.office": entry(["admin"], "admin"),
  "audit.read.own": entry(["admin", "user"]),
  "monitor.office": entry(["admin"], "admin"),
  "announce.office": entry(["admin"], "admin"),
  "ai.chat": entry(["developer", "admin", "user"]),
  "ai.forecast.read": entry(["developer", "admin", "user"]),
  "export.run": entry(["developer", "admin"]),
} as const satisfies Record<string, Entry>;

export type Permission = keyof typeof CATALOG;

export const PERMISSIONS = Object.keys(CATALOG) as Permission[];

export type Grant = {
  subjectType: "user" | "office";
  permission: string;
  effect: "allow" | "deny";
  expiresAt: Date | null;
};

function decide(grants: Grant[]): boolean | null {
  if (grants.some((g) => g.effect === "deny")) return false;
  return grants.length > 0 ? true : null;
}

/** A person's rule beats an office rule, which beats the role default. Deny beats allow within a level. */
export function isAllowed(role: Role, permission: Permission, grants: Grant[], now = new Date()): boolean {
  const { defaults, minRole }: Entry = CATALOG[permission];
  if (RANK[role] < RANK[minRole]) return false;

  const active = grants.filter((g) => g.permission === permission && (!g.expiresAt || g.expiresAt > now));
  return (
    decide(active.filter((g) => g.subjectType === "user")) ??
    decide(active.filter((g) => g.subjectType === "office")) ??
    defaults.includes(role)
  );
}

export const canEverHold = (role: Role, permission: Permission) => RANK[role] >= RANK[(CATALOG[permission] as Entry).minRole];

export const roleDefault = (role: Role, permission: Permission) => (CATALOG[permission] as Entry).defaults.includes(role);

export function effectivePermissions(role: Role, grants: Grant[], now = new Date()): Permission[] {
  return PERMISSIONS.filter((permission) => isAllowed(role, permission, grants, now));
}
