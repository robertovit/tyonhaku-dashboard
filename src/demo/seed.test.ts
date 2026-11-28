import { describe, expect, it } from "vitest";
import { demoSeed } from "./seed";
import { FIXTURE, FIXTURE_TODAY } from "../dev/fixtures";
import { addDays, dayDiff, fmtDate, weekday } from "../lib/dates";
import { gameState, xpForApp } from "../lib/game";
import { followups } from "../lib/stats";
import { normalize } from "../lib/model";

describe("demoSeed", () => {
  it("keeps the fixture as is on its own day", () => {
    const seed = demoSeed(FIXTURE_TODAY);
    expect(seed.slice(0, FIXTURE.length).map(([, d]) => d.d)).toEqual(FIXTURE.map(([, d]) => d.d));
  });

  it("moves the fixture forward in whole weeks so the last application is recent", () => {
    const today = "2027-03-17";
    const seed = demoSeed(today);
    const [id, first] = seed[0];
    expect(id).toBe(FIXTURE[0][0]);
    const shift = dayDiff(FIXTURE[0][1].d as string, first.d as string);
    expect(shift % 7).toBe(0);
    expect(weekday(first.d as string)).toBe(weekday(FIXTURE[0][1].d as string));
    expect(first.end).toBe(fmtDate(addDays("2026-07-22", shift))); // fixture end "22.7.", still written as "P.K."
    const last = seed
      .slice(0, FIXTURE.length)
      .map(([, d]) => d.d as string)
      .sort()
      .at(-1)!;
    expect(dayDiff(last, today)).toBeGreaterThanOrEqual(0);
    expect(dayDiff(last, today)).toBeLessThan(
      7 +
        dayDiff(
          FIXTURE.map(([, d]) => d.d as string)
            .sort()
            .at(-1)!,
          FIXTURE_TODAY,
        ),
    );
  });

  it("adds two saved ads with upcoming deadlines", () => {
    const todos = demoSeed("2027-03-17").filter(([, d]) => d.status === "todo");
    expect(todos.map(([, d]) => d.end)).toEqual(["20.3.", "29.3."]);
  });

  it("adds two applications sent this week", () => {
    const sent = demoSeed("2027-03-17").filter(([id]) => id.startsWith("demo-sent"));
    expect(sent.map(([, d]) => d.d)).toEqual(["2027-03-15", "2027-03-17"]); // Monday and today (a Wednesday)
  });

  it("adds an application whose history shows an interview before the rejection", () => {
    const [, doc] = demoSeed("2027-03-17").find(([id]) => id === "demo-hist-1")!;
    const app = normalize("demo-hist-1", doc, "2027-03-17");
    expect(app.events).toEqual([
      { status: "int", d: "2027-03-03" },
      { status: "no", d: "2027-03-14" },
    ]);
    expect(xpForApp(app)).toBe(66); // 10 + cover letter 3 + rejection 3 + interview 50
  });

  it("starts one rejection short of the third shield, with old applications to mark rejected", () => {
    const today = "2027-03-17";
    const apps = demoSeed(today)
      .map(([id, d]) => normalize(id, d, today))
      .filter((a) => a.status !== "todo");
    expect(gameState(apps, 3, today).no).toBe(9);
    expect(followups(apps, today).due.length).toBeGreaterThanOrEqual(5);
  });

  it("shows Räätälöijä at 3 / 5, and marking the saved place with a CV version applied takes it to 4", () => {
    const today = "2027-03-17";
    const all = demoSeed(today).map(([id, d]) => normalize(id, d, today));
    const sent = all.filter((a) => a.status !== "todo");
    expect(gameState(sent, 3, today).tailored).toBe(3);
    const todo = all.find((a) => a.id === "demo-todo-1")!;
    expect(gameState([...sent, { ...todo, status: "wait", d: today }], 3, today).tailored).toBe(4);
  });
});
