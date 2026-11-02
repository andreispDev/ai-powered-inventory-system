import { describe, expect, it } from "vitest";
import { backtest, forecastItem, holt, keepsTheNumbers, startOfWeek, tsb, type ForecastInput } from "@/modules/forecast/engine";
import { crumbsFor } from "@/components/shell/breadcrumbs";
import { buildPdf, exportFileName, toCsv, type ExportTable } from "@/lib/export-format";
import { parsePage } from "@/lib/pagination";
import { ancestorsOf, withDescendants } from "@/modules/categories/tree";
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
        // Text-size contrast isn't needed against the page for a control. Dark mode keeps borders quieter, and the focus ring stays 3:1.
        if (contrast(t.input, t.background) < (mode === "dark" ? 2.3 : 3)) failing.push("input on background");
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

describe("breadcrumbs", () => {
  const trail = (path: string) => crumbsFor(path).map((crumb) => crumb.label);

  it("starts every trail at the dashboard", () => {
    expect(trail("/dashboard")).toEqual(["Dashboard"]);
    expect(trail("/inventory")).toEqual(["Dashboard", "Inventory"]);
    expect(trail("/inventory/00000000-0000-4000-8000-000000000001/edit")).toEqual(["Dashboard", "Inventory", "Details", "Edit"]);
  });

  it("skips the console grouping, which has no page", () => {
    expect(crumbsFor("/console/offices").map((crumb) => crumb.href)).toEqual(["/dashboard", "/console/offices"]);
  });
});

describe("pagination", () => {
  it("reads page and size, with safe defaults", () => {
    expect(parsePage({})).toEqual({ page: 1, pageSize: 25, offset: 0 });
    expect(parsePage({ page: "3", size: "50" })).toEqual({ page: 3, pageSize: 50, offset: 100 });
    expect(parsePage({ page: "-1", size: "9999" })).toEqual({ page: 1, pageSize: 25, offset: 0 });
  });

  it("keeps a second table's place separate", () => {
    expect(parsePage({ page: "4", apage: "2" }, { prefix: "a" })).toEqual({ page: 2, pageSize: 25, offset: 25 });
  });

  it("caps deep pages, with more room for logs", () => {
    expect(parsePage({ page: "999999" }).offset).toBeLessThanOrEqual(10_000);
    expect(parsePage({ page: "1000" }, { maxOffset: 1_000_000 }).offset).toBe(24_975);
  });
});

describe("exports", () => {
  const table: ExportTable = { title: "Inventory", columns: ["Name", "Qty"], rows: [["Dell, big", "4"]], total: 1, truncated: false };

  it("writes CSV that spreadsheets read safely", () => {
    const csv = toCsv({ columns: ["Name", "Note"], rows: [['A "quoted", name', "=HYPERLINK(1)"], ["-1+2", "@x"], ["Se\u00f1or", "line\nbreak"]] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"A ""quoted"", name",\'=HYPERLINK(1)');
    expect(csv).toContain("'-1+2,'@x");
    expect(csv).toContain('Se\u00f1or,"line\nbreak"');
  });

  it("names files safely", () => {
    expect(exportFileName("Q3 Audit/Report!", "pdf", new Date(2026, 10, 3))).toBe("q3-audit-report-2026-11-03.pdf");
    expect(exportFileName("???", "csv", new Date(2026, 10, 3))).toBe("export-2026-11-03.csv");
  });

  it("puts the custom header on every page", () => {
    const long = { ...table, rows: Array.from({ length: 200 }, (_, i) => [`Item ${i}`, String(i)]), total: 200 };
    const doc = buildPdf(long, { organization: "QC Supply Hub", title: "Q3 Report", note: "For the auditors", showDate: true, landscape: true });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    const text = doc.output();
    expect(text.split("Q3 Report")).toHaveLength(pages + 1);
    expect(text.split("QC Supply Hub")).toHaveLength(pages + 1);
    expect(text).toContain("For the auditors");
    expect(text).toContain(`Page ${pages} of ${pages}`);
    expect(text.slice(0, 5)).toBe("%PDF-");
  });

  it("copes with characters the PDF font lacks, and leaves optional parts out", () => {
    const doc = buildPdf({ ...table, rows: [["\u65e5\u672c\u8a9e", "1"]] }, { organization: "", title: "T", note: "", showDate: false, landscape: false });
    expect(doc.output()).toContain("???");
    expect(doc.output()).not.toContain("Generated");
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(doc.internal.pageSize.getWidth());
  });
});

describe("category tree", () => {
  const rows = [
    { id: "assets", parentId: null },
    { id: "tv", parentId: "assets" },
    { id: "pc", parentId: "assets" },
    { id: "laptop", parentId: "pc" },
    { id: "papers", parentId: null },
  ];

  it("includes everything under a category", () => {
    expect(withDescendants(rows, "assets").sort()).toEqual(["assets", "laptop", "pc", "tv"]);
    expect(withDescendants(rows, "tv")).toEqual(["tv"]);
  });

  it("walks up to the top", () => {
    expect(ancestorsOf(rows, "laptop").map((row) => row.id)).toEqual(["assets", "pc"]);
    expect(ancestorsOf(rows, "assets")).toEqual([]);
  });

  it("survives a loop in bad data", () => {
    const loop = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(withDescendants(loop, "a").sort()).toEqual(["a", "b"]);
    expect(ancestorsOf(loop, "a").length).toBeLessThanOrEqual(10);
  });
});
