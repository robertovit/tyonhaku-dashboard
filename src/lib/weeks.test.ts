import { describe, expect, it } from "vitest";
import { isoWeek, isoWeekYear, weekKey, weekLabel } from "./dates";
import { gameState, XP_RULES } from "./game";
import { normalize, type Application } from "./model";
import { weeklySeries } from "./stats";

const app = (id: string, d: string): Application =>
  normalize(id, { d, org: `Työnantaja ${id}`, role: "Analyytikko", status: "wait" }, d);

describe("week key at the turn of the year", () => {
  it("puts 31.12.2026 and 2.1.2027 in the same ISO week (53 of 2026)", () => {
    expect(weekKey("2026-12-31")).toBe("2026-12-28");
    expect(weekKey("2027-01-02")).toBe("2026-12-28");
    expect(weekKey("2027-01-03")).toBe("2026-12-28");
    expect(weekKey("2027-01-04")).toBe("2027-01-04");
    expect(isoWeek("2027-01-02")).toBe(53);
    expect(isoWeekYear("2027-01-02")).toBe(2026);
  });
  it("keeps week 1 of 2026 apart from week 1 of 2025", () => {
    expect(weekKey("2025-12-29")).not.toBe(weekKey("2025-01-01"));
    expect(weekKey("2025-12-29")).toBe("2025-12-29");
  });
  it("labels a week with its year only when it is not this year's", () => {
    expect(weekLabel("2026-12-28", "2026-12-30")).toBe("vko 53");
    expect(weekLabel("2026-12-28", "2027-03-01")).toBe("vko 53/2026");
    expect(weekLabel("2026-12-28", "2027-01-02")).toBe("vko 53"); // still the same ISO week
  });
  it("counts the week once in the weekly series and treats it as the current week", () => {
    const apps = [app("a", "2026-12-29"), app("b", "2027-01-02")];
    const w = weeklySeries(apps, "2027-01-02");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ key: "2026-12-28", week: 53, count: 2, cumulative: 2, isNow: true });
  });
  it("does not count the same applications twice when week 1 keys used to collide", () => {
    const apps = [app("a", "2025-01-01"), app("b", "2025-12-30")];
    const w = weeklySeries(apps, "2025-12-31");
    expect(w.at(-1)?.cumulative).toBe(2);
    expect(w.reduce((s, x) => s + x.count, 0)).toBe(2);
  });
  it("keeps the streak, weekly goals and XP across the turn of the year", () => {
    const apps = [
      app("a1", "2026-12-21"),
      app("a2", "2026-12-23"),
      app("b1", "2026-12-31"),
      app("b2", "2027-01-02"),
      app("c1", "2027-01-05"),
      app("c2", "2027-01-06"),
    ];
    const g = gameState(apps, 2, "2027-01-06");
    expect(g.weeks).toMatchObject({ met: 3, best: 3, current: 3, thisWeek: 2 });
    expect(g.xp).toBe(6 * XP_RULES.application + 3 * XP_RULES.fullWeek);
    expect(g.badges).toContain("streak3");
  });
});
