import { describe, expect, it } from "vitest";
import { demoSeed } from "./seed";
import { FIXTURE, FIXTURE_TODAY } from "../dev/fixtures";
import { addDays, dayDiff, fmtDate, weekday } from "../lib/dates";

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
});
