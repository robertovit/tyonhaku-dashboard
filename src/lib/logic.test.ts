import { describe, expect, it } from "vitest";
import { FIXTURE, FIXTURE_TODAY } from "../dev/fixtures";
import { classifyType, normalize, toDoc } from "./model";
import { dayDiff, deadlineIso, isoWeek, parseFinDate, waitingSince, weekKey } from "./dates";
import { followups, funnel, orgRanking, summary, weeklySeries } from "./stats";
import { badgeWeeks, celebrationFor, gameState, levelFor, XP_RULES, xpForApp, xpParts } from "./game";
import { toCsv } from "./csv";

const today = FIXTURE_TODAY;
const apps = FIXTURE.map(([id, d]) => normalize(id, d, today));

describe("dates", () => {
  it("computes ISO weeks", () => {
    expect(isoWeek("2026-08-15")).toBe(33);
    expect(isoWeek("2026-10-03")).toBe(40);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(weekKey("2026-07-12")).toBe("2026-28");
  });
  it("parses Finnish deadlines, rolling over the new year and rejecting impossible dates", () => {
    expect(parseFinDate("7.12.", "2026-11-24")).toBe("2026-12-07");
    expect(parseFinDate("15.1.", "2026-11-24")).toBe("2027-01-15");
    expect(parseFinDate("31.2.", "2026-11-24")).toBeNull();
    expect(deadlineIso({ d: "2026-11-24", end: "jatkuva haku" })).toBeNull();
  });
  it("counts the wait from the deadline when it is later than the application", () => {
    expect(waitingSince({ d: "2026-08-15", end: "23.8." })).toBe("2026-08-23");
    expect(waitingSince({ d: "2026-09-13", end: "jatkuva haku" })).toBe("2026-09-13");
    expect(dayDiff("2026-08-23", today)).toBe(41);
  });
});

describe("model", () => {
  it("normalizes partial and old documents", () => {
    const a = normalize("x", { org: "Testi", role: "Data Trainee" }, today);
    expect(a).toMatchObject({
      d: today,
      status: "wait",
      type: "trainee",
      n: null,
      schema: 2,
      snoozeUntil: "",
      events: [],
    });
    expect(normalize("y", { status: "bogus", url: "javascript:alert(1)" }, today)).toMatchObject({
      status: "wait",
      url: "",
    });
  });
  it("classifies job types from the title", () => {
    expect(classifyType("DNA", "Avoin hakemus")).toBe("open");
    expect(classifyType("X", "Korkeakouluharjoittelija")).toBe("trainee");
    expect(classifyType("X", "BI-asiantuntija")).toBe("expert");
  });
  it("drops derived fields when storing", () => {
    expect(toDoc(apps[0])).not.toHaveProperty("id");
    expect(toDoc(apps[0])).not.toHaveProperty("top");
  });
  it("flags the applicant who ranked first", () => {
    expect(apps.filter((a) => a.top).map((a) => a.org)).toEqual(["Logistiikka Oyj"]);
  });
});

describe("stats", () => {
  it("summarizes the search", () => {
    const s = summary(apps);
    expect(s.total).toBe(20);
    expect(s.counts).toEqual({ offer: 0, int: 1, wait: 6, no: 13, todo: 0 });
    expect(s.answered).toBe(14);
    expect(s.medianN).toBe(150);
    expect(s.orgCount).toBe(14);
  });
  it("groups employers case-insensitively", () => {
    expect(orgRanking(apps)).toEqual([
      ["Valtionvirasto", 5],
      ["Konsulttitalo", 3],
      ["Muut (12 työnantajaa)", 12],
    ]);
  });
  it("lists follow-ups, skipping open applications and snoozed ones", () => {
    const { due } = followups(apps, today);
    expect(due.map((f) => [f.app.org, f.days])).toEqual([
      ["Konepaja Oyj", 41],
      ["Valtionvirasto", 32],
      ["IT-konserni", 23],
    ]);
    const snoozedApps = apps.map((a) => (a.org === "IT-konserni" ? { ...a, snoozeUntil: "2026-10-20" } : a));
    const r = followups(snoozedApps, today);
    expect(r.due).toHaveLength(2);
    expect(r.snoozed).toHaveLength(1);
  });
  it("builds the outcome funnel", () => {
    expect(funnel(apps).map((r) => r.value)).toEqual([20, 14, 1, 0]);
  });
  it("buckets applications per ISO week up to the current week", () => {
    const w = weeklySeries(apps, today);
    expect(w[0].week).toBe(28);
    expect(w[w.length - 1]).toMatchObject({ week: 40, isNow: true, count: 0, cumulative: 20 });
    expect(w.find((x) => x.week === 33)?.count).toBe(10);
  });
});

describe("game", () => {
  const g = gameState(apps, 5, today);
  it("derives XP, level and badges", () => {
    expect(g.xp).toBe(380);
    expect(g.level).toMatchObject({ n: 3, name: "Hakemuskone", from: 250, to: 450 });
    expect(g.badges).toHaveLength(10);
    expect(g.badges).not.toContain("quarter");
    expect(g.weeks).toMatchObject({ met: 2, best: 1, current: 0, thisWeek: 0 });
  });
  it("names legend levels past the last named level", () => {
    expect(levelFor(1400).name).toBe("Työnhaun mestari");
    expect(levelFor(1950)).toMatchObject({ n: 8, name: "Työnhaun legenda 1" });
  });
  it("celebrates a level-up with a new badge and a full week", () => {
    const extra = Array.from({ length: 5 }, (_, i) => normalize(`n${i}`, { d: "2026-10-02", org: `Uusi ${i}` }, today));
    const after = gameState([...apps, ...extra], 5, today);
    const c = celebrationFor(g, after)!;
    expect(after.level.n).toBe(4);
    // the 25th application opens the post stamp: its title replaces "Uusi saavutus: 25 hakemusta"
    expect(c.title).toBe("Postileimasin avattu");
    expect(c.post?.id).toBe("postmark");
    expect(c.newBadges).toEqual(["quarter"]);
    expect(c.text).toContain("+70 XP");
    expect(c.text).toContain("Viikkotavoite täynnä!");
    expect(c.text).not.toContain("Uusi saavutus");
    expect(c.confetti).toBe(160);
  });
  it("splits XP per application so the parts add up to the total", () => {
    const perApp = apps.reduce((s, a) => s + xpForApp(a), 0);
    expect(perApp + g.weeks.met * XP_RULES.fullWeek).toBe(g.xp);
    expect(xpParts({ cv: "CV_UX", att: "CV, saatekirje", status: "offer" }).map((p) => p.xp)).toEqual([
      10, 5, 3, 50, 200,
    ]);
  });
  it("dates every earned badge to the week it was reached", () => {
    const w = badgeWeeks(apps, 5, today);
    expect(Object.keys(w).sort()).toEqual([...g.badges].sort());
    expect(w.first).toBe(28);
    expect(w.burst).toBe(33);
  });
  it("gives no XP for a saved ad that is not applied yet", () => {
    expect(xpForApp({ cv: "CV", att: "CV, saatekirje", status: "todo" })).toBe(0);
    const todo = normalize("t", { org: "Haettava Oy", status: "todo", d: today }, today);
    expect(todo.status).toBe("todo");
  });
  it("gives a small note for a handled rejection", () => {
    const after = gameState(
      apps.map((a) => (a.org === "Konepaja Oyj" ? { ...a, status: "no" as const } : a)),
      5,
      today,
    );
    expect(celebrationFor(g, after)).toMatchObject({ title: "+3 XP", confetti: 0 });
  });
});

describe("csv", () => {
  it("exports every application with quoting", () => {
    const csv = toCsv(apps);
    expect(csv.startsWith("﻿Haettu,")).toBe(true);
    expect(csv.trim().split("\r\n")).toHaveLength(21);
    expect(csv).toContain('"Haastattelu, yrityksellä rekrykielto, olin nr. 1 hakija"');
  });
});
