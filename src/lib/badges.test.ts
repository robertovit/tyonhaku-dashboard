import { describe, expect, it } from "vitest";
import { FIXTURE, FIXTURE_TODAY } from "../dev/fixtures";
import {
  ARCHIVED_BADGES,
  BADGES,
  badgeProgress,
  badgeWeeks,
  celebrationFor,
  celebrationWatch,
  EFFORT_BADGES,
  gameState,
} from "./game";
import { normalize, type Application } from "./model";

const app = (id: string, d: string, more: Record<string, unknown> = {}): Application =>
  normalize(id, { d, org: `Työnantaja ${id}`, role: "Analyytikko", status: "wait", ...more }, d);
const badge = (id: string) => BADGES.find((b) => b.id === id)!;
const fixture = FIXTURE.map(([id, d]) => normalize(id, d, FIXTURE_TODAY));

describe("Oma tahti", () => {
  it("counts the week at the turn of the year once", () => {
    const g = gameState([app("a", "2026-12-31"), app("b", "2027-01-02"), app("c", "2027-01-05")], 5, "2027-01-05");
    expect(g.activeWeeks).toBe(2);
  });
  it("takes one step per week, however many applications the week had", () => {
    const g = gameState([app("a", "2026-11-23"), app("b", "2026-11-25"), app("c", "2026-11-29")], 5, "2026-11-29");
    expect(g.activeWeeks).toBe(1);
    expect(badgeProgress(badge("pace"), g)).toMatchObject({ have: 1, need: 4, left: 3, done: false });
  });
  it("keeps the weeks on both sides of a pause", () => {
    const apps = [
      app("a", "2026-09-07"),
      app("b", "2026-09-14"),
      // six weeks without applications
      app("c", "2026-11-02"),
      app("d", "2026-11-12"),
    ];
    const g = gameState(apps, 5, "2026-11-28");
    expect(g.activeWeeks).toBe(4);
    expect(g.badges).toContain("pace");
    expect(g.weeks.current).toBe(0); // the weekly streak is a separate thing
    expect(badgeWeeks(apps, 5, "2026-11-28").pace).toBe("2026-11-09");
  });
  it("does not depend on the weekly goal", () => {
    const at = (goal: number) => gameState(fixture, goal, FIXTURE_TODAY);
    expect(at(1).activeWeeks).toBe(at(10).activeWeeks);
    expect(at(1).tailored).toBe(at(10).tailored);
    expect(at(1).badges.includes("pace")).toBe(at(10).badges.includes("pace"));
    expect(at(1).weeks.met).not.toBe(at(10).weeks.met);
  });
  it("is earned at once with older data, without celebrating on the first load", () => {
    const watch = celebrationWatch(() => 0);
    const g = gameState(fixture, 5, FIXTURE_TODAY);
    expect(g.badges).toContain("pace");
    watch.arm("");
    expect(watch.see(g, false)).toBeNull();
  });
  it("gives no XP: the XP sum is the same with or without the badge", () => {
    const g = gameState(fixture, 5, FIXTURE_TODAY);
    expect(g.xp).toBe(380);
  });
});

describe("progress and earning come from the same count", () => {
  it("agrees for every badge", () => {
    for (const goal of [1, 3, 5]) {
      const g = gameState(fixture, goal, FIXTURE_TODAY);
      for (const b of BADGES) expect(badgeProgress(b, g).done).toBe(g.badges.includes(b.id));
    }
  });
  it("says Räätälöijä counts sent applications with a CV version", () => {
    const apps = [1, 2, 3].map((i) => app(`cv${i}`, "2026-11-2" + i, { cv: `CV_${i}` }));
    const g = gameState([...apps, app("x", "2026-11-24")], 5, "2026-11-28");
    const b = badge("tailor");
    const p = badgeProgress(b, g);
    expect(`${p.have} / ${b.unit!(p.need)}`).toBe("3 / 5 hakemusta, joissa on CV-versio");
    expect(b.next!(p.left)).toMatch(/^Vielä 2\. .*Lisätiedot → CV-versio/);
    expect(b.unit!(1)).toBe("1 hakemus, jossa on CV-versio");
  });
  it("leaves a saved ad out until it is sent, even with a CV version", () => {
    const sent = [app("a", "2026-11-23", { cv: "CV_A" })];
    const todo = app("t", "2026-11-28", { status: "todo", cv: "CV_T" });
    const before = gameState(sent, 5, "2026-11-28");
    // App.tsx gives the game only sent applications; a saved ad never reaches it
    const after = gameState(
      [...sent, todo].filter((a) => a.status !== "todo"),
      5,
      "2026-11-28",
    );
    expect(after).toMatchObject({ tailored: 1, activeWeeks: 1 });
    expect(celebrationFor(before, after, "Tallennettu")).toBeNull();
  });
});

describe("collection", () => {
  it("puts Räätälöijä and Oma tahti first", () => {
    expect(EFFORT_BADGES.map((b) => b.id)).toEqual(["tailor", "pace", "week", "streak3", "variety"]);
  });
  it("moves one-day volume and other applicants' numbers to the earlier badges, still earnable", () => {
    expect(EFFORT_BADGES.map((b) => b.id)).not.toContain("burst");
    expect(ARCHIVED_BADGES.map((b) => b.id)).toEqual(expect.arrayContaining(["burst", "bigwater"]));
    const g = gameState(fixture, 5, FIXTURE_TODAY);
    expect(g.badges).toEqual(expect.arrayContaining(["burst", "bigwater"]));
    // reaching one later opens it quietly
    const nine = Array.from({ length: 9 }, (_, i) => app(`b${i}`, "2026-11-20"));
    const before = gameState(nine, 5, "2026-11-20");
    const after = gameState([...nine, app("b9", "2026-11-20")], 5, "2026-11-20");
    expect(after.badges).toContain("burst");
    expect(celebrationFor(before, after)!.newBadges).not.toContain("burst");
  });
});

describe("feedback for a badge without XP", () => {
  it("names the badge when a corrected send date opens it", () => {
    // three weeks of applications, then one moved from a busy week to a week of its own
    const apps = [app("a", "2026-10-05"), app("b", "2026-10-12"), app("c", "2026-10-19"), app("d", "2026-10-19")];
    const moved = apps.map((a) => (a.id === "d" ? { ...a, d: "2026-10-26" } : a));
    const before = gameState(apps, 5, "2026-11-28");
    const after = gameState(moved, 5, "2026-11-28");
    expect(after.xp - before.xp).toBe(0);
    const c = celebrationFor(before, after)!;
    expect(c.title).toBe("Uusi merkki: Oma tahti");
    expect(c.text).not.toContain("XP");
    expect(c.text).not.toContain("Uusi saavutus: Oma tahti");
    expect(c.newBadges).toEqual(["pace"]);
  });
  it("keeps the save label and XP when the badge comes with a new application", () => {
    const three = [app("a", "2026-10-05"), app("b", "2026-10-12"), app("c", "2026-10-19")];
    const before = gameState(three, 5, "2026-11-28");
    const after = gameState([...three, app("d", "2026-11-23")], 5, "2026-11-28");
    const c = celebrationFor(before, after, "Merkitty haetuksi")!;
    expect(c.title).toBe("Merkitty haetuksi · +10 XP");
    expect(c.text).toContain("Uusi saavutus: Oma tahti");
  });
});
