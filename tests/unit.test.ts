import { describe, expect, it } from "vitest";
import { backtest, forecastItem, holt, keepsTheNumbers, startOfWeek, tsb, type ForecastInput } from "@/modules/forecast/engine";
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

describe("stock forecasts", () => {
  const now = new Date("2026-11-04T12:00:00Z"); // A Wednesday
  const weeksAgo = (weeks: number) => new Date(startOfWeek(now).getTime() - weeks * 7 * 86_400_000);
  const input = (usage: number[], over: Partial<ForecastInput> = {}): ForecastInput => ({
    quantity: 20,
    unit: "pcs",
    firstMovementAt: weeksAgo(usage.length),
    demandMovements: usage.filter(Boolean).length,
    demandByWeek: Object.fromEntries(usage.map((used, index) => [weeksAgo(usage.length - index).toISOString().slice(0, 10), used])),
    ...over,
  });

  it("predicts steady use and when it runs out", () => {
    const result = forecastItem(input(Array(12).fill(5)), now);
    expect(result).toMatchObject({ state: "ready", method: "holt", weeklyDemand: 5, stockoutAt: "2026-12-02", confidence: "high" });
    expect(result.reorderQuantity).toBeGreaterThan(0);
    expect(result.reason).toContain("5 pcs a week");
  });

  it("handles stock used only in some weeks", () => {
    const result = forecastItem(input([6, 0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 6]), now);
    expect(result.method).toBe("tsb");
    expect(result.weeklyDemand).toBeGreaterThan(1);
    expect(result.weeklyDemand).toBeLessThan(4);
  });

  it("says so instead of guessing with too little history", () => {
    expect(forecastItem(input([5, 5, 5]), now).state).toBe("not_enough_history");
    expect(forecastItem(input(Array(12).fill(0).map((_, i) => (i % 4 === 3 ? 1 : 0))), now).state).toBe("not_enough_history");
    expect(forecastItem(input([], { firstMovementAt: null }), now).state).toBe("not_enough_history");
    expect(forecastItem(input([5, 5, 5]), now).stockoutAt).toBeNull();
  });

  it("marks stock nobody has used lately as slow moving", () => {
    expect(forecastItem(input([3, 3, 3, 3, 3, ...Array(8).fill(0)]), now).state).toBe("slow");
  });

  it("ignores the unfinished current week", () => {
    const usage = input(Array(12).fill(5));
    usage.demandByWeek[startOfWeek(now).toISOString().slice(0, 10)] = 500;
    expect(forecastItem(usage, now).weeklyDemand).toBe(5);
  });

  it("gives no date beyond a year, and an out-of-stock item runs out today", () => {
    expect(forecastItem(input(Array(12).fill(1), { quantity: 1000 }), now).stockoutAt).toBeNull();
    expect(forecastItem(input(Array(12).fill(5), { quantity: 0 }), now).stockoutAt).toBe("2026-11-04");
  });

  it("marks forecasts that lose to the simple baseline as low confidence", () => {
    const repeating = [0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40];
    const { error, baselineError } = backtest(repeating, tsb);
    expect(error).toBeGreaterThan(baselineError);
    expect(forecastItem(input(repeating, { demandMovements: 5 }), now).confidence).toBe("low");
  });

  it("never predicts negative use", () => {
    expect(holt.predictNext([50, 30, 10, 0, 0])).toBeGreaterThanOrEqual(0);
    expect(tsb.predictNext([0, 0, 0])).toBe(0);
  });

  it("rejects AI wording that changes a number", () => {
    const note = "Uses about 5 units a week, and 20 are left. Expect to run out around 2 Dec 2026.";
    expect(keepsTheNumbers(note, "With 20 left at about 5 a week, this runs out near 2 Dec 2026.")).toBe(true);
    expect(keepsTheNumbers(note, "With 25 left at about 5 a week, this runs out near 2 Dec 2026.")).toBe(false);
    expect(keepsTheNumbers(note, "This runs out soon.")).toBe(false);
    expect(keepsTheNumbers(note, "")).toBe(false);
  });
});
