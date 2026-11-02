import { describe, expect, it } from "vitest";
import { canStartSession, isPastAbsoluteLimit } from "@/server/auth/sign-in-rules";
import { effectivePermissions, isAllowed, type Grant } from "@/server/authz/catalog";
import { contrast, themeTokens, THEMES, type Oklch } from "@/lib/theme-tokens";

const grant = (over: Partial<Grant>): Grant => ({
  subjectType: "user",
  permission: "item.delete",
  effect: "allow",
  expiresAt: null,
  ...over,
});

describe("permissions", () => {
  it("uses role defaults with no grants", () => {
    expect(isAllowed("user", "item.delete", [])).toBe(true);
    expect(isAllowed("admin", "item.delete", [])).toBe(false);
    expect(isAllowed("developer", "item.delete", [])).toBe(false);
  });

  it("lets a grant give an admin a feature, as in the brief", () => {
    expect(isAllowed("admin", "item.delete", [grant({})])).toBe(true);
  });

  it("puts a person's rule above an office rule", () => {
    const rules = [grant({ subjectType: "office", effect: "deny" }), grant({ subjectType: "user", effect: "allow" })];
    expect(isAllowed("user", "item.delete", rules)).toBe(true);
  });

  it("puts an office rule above the role default", () => {
    expect(isAllowed("user", "item.delete", [grant({ subjectType: "office", effect: "deny" })])).toBe(false);
  });

  it("lets deny win at the same level", () => {
    expect(isAllowed("admin", "item.delete", [grant({}), grant({ effect: "deny" })])).toBe(false);
  });

  it("ignores expired grants", () => {
    const now = new Date("2026-11-02");
    expect(isAllowed("admin", "item.delete", [grant({ expiresAt: new Date("2026-11-01") })], now)).toBe(false);
    expect(isAllowed("admin", "item.delete", [grant({ expiresAt: new Date("2026-11-03") })], now)).toBe(true);
  });

  it("never lets a grant raise someone past a permission's minimum role", () => {
    const rule = grant({ permission: "permission.grant" });
    expect(isAllowed("user", "permission.grant", [rule])).toBe(false);
    expect(isAllowed("admin", "permission.grant", [rule])).toBe(false);
    expect(isAllowed("admin", "office.manage", [grant({ permission: "office.manage" })])).toBe(false);
  });

  it("keeps developers read-only on inventory by default", () => {
    const list = effectivePermissions("developer", []);
    expect(list).toContain("item.read");
    expect(list).not.toContain("item.create");
    expect(list).not.toContain("stock.move");
  });
});

describe("sign-in rules", () => {
  it("allows only verified, non-deactivated, provisioned accounts", () => {
    expect(canStartSession(undefined)).toBe(false);
    expect(canStartSession({ emailVerified: false, status: "active" })).toBe(false);
    expect(canStartSession({ emailVerified: true, status: "deactivated" })).toBe(false);
    expect(canStartSession({ emailVerified: true, status: "invited" })).toBe(true);
    expect(canStartSession({ emailVerified: true, status: "active" })).toBe(true);
  });

  it("ends sessions 7 days after sign-in", () => {
    const start = new Date("2026-11-01");
    expect(isPastAbsoluteLimit(start, new Date("2026-11-07"))).toBe(false);
    expect(isPastAbsoluteLimit(start, new Date("2026-11-09"))).toBe(true);
  });
});

describe("themes", () => {
  const TEXT_PAIRS = [
    ["foreground", "background"],
    ["card-foreground", "card"],
    ["popover-foreground", "popover"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["muted-foreground", "background"],
    ["muted-foreground", "muted"],
    ["accent-foreground", "accent"],
    ["destructive-foreground", "destructive"],
    ["success", "background"],
    ["warning", "background"],
    ["info", "background"],
    ["success", "success-subtle"],
    ["warning", "warning-subtle"],
    ["info", "info-subtle"],
    ["sidebar-foreground", "sidebar"],
    ["sidebar-accent-foreground", "sidebar-accent"],
    ["sidebar-primary-foreground", "sidebar-primary"],
  ] as const;

  it("offers the 12 color themes", () => {
    expect(THEMES).toHaveLength(12);
  });

  for (const theme of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      it(`${theme.id} ${mode} meets WCAG AA contrast`, () => {
        const t: Record<string, Oklch> = themeTokens(theme, mode);
        const failing = TEXT_PAIRS.filter(([fg, bg]) => contrast(t[fg], t[bg]) < 4.5).map(
          ([fg, bg]) => `${fg} on ${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`,
        );
        // Text-size contrast isn't needed against the page for a control, only 3:1.
        if (contrast(t.input, t.background) < 3) failing.push("input on background");
        if (contrast(t.ring, t.background) < 3) failing.push("ring on background");
        expect(failing).toEqual([]);
      });
    }
  }
});
