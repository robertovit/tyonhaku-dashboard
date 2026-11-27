// Example data for the public demo: the invented fixture moved forward in whole weeks so that it always ends in
// the current week (charts and reminders look alive), plus a few items dated around today.
import { FIXTURE, FIXTURE_TODAY } from "../dev/fixtures";
import { addDays, dayDiff, fmtDate, parseFinDate, weekday } from "../lib/dates";

type Docs = [string, Record<string, unknown>][];

const ISO = /^\d{4}-\d{2}-\d{2}/;
// Five of the fixture's rejections have no answer yet in the demo, so it starts at 9 rejections: the Today panel's
// follow-up "Kuittaa ei valituksi" then opens the third shield (10 rejections, lib/shields.ts) in a click.
const STILL_WAITING = new Set(["app-05", "app-08", "app-09", "app-10", "app-11"]);

export function demoSeed(today: string): Docs {
  const shift = Math.max(0, Math.floor(dayDiff(FIXTURE_TODAY, today) / 7)) * 7;
  const day = (v: unknown) => (typeof v === "string" && ISO.test(v) ? addDays(v.slice(0, 10), shift) + v.slice(10) : v);

  const apps: Docs = FIXTURE.map(([id, d]) => {
    const end = typeof d.end === "string" ? d.end : "";
    const due = typeof d.d === "string" ? parseFinDate(end, d.d) : null;
    return [
      id,
      {
        ...d,
        ...(STILL_WAITING.has(id) && { status: "wait" }),
        d: day(d.d),
        end: due ? fmtDate(addDays(due, shift)) : end,
        createdAt: day(d.createdAt),
        updatedAt: day(d.updatedAt),
        snoozeUntil: day(d.snoozeUntil),
      },
    ];
  });

  const doc = (
    d: string,
    end: string,
    org: string,
    role: string,
    type: string,
    status: string,
    events: { status: string; d: string }[] = [],
  ) => ({
    schema: 2,
    d,
    end,
    org,
    role,
    how: "Nettilomake",
    att: "CV, saatekirje",
    cv: "",
    note: "",
    url: "https://example.com/ilmoitus/demo",
    status,
    type,
    n: null,
    nPlus: false,
    createdAt: `${d}T00:00:00Z`,
    updatedAt: `${d}T00:00:00Z`,
    snoozeUntil: "",
    events,
  });
  // Saved ads (Haettavat) with deadlines in a few days, and two applications sent this week (weekly goal 2/3).
  const monday = addDays(today, -weekday(today));
  return [
    ...apps,
    ["demo-sent-1", doc(monday, "", "Tunturi Analytics Oy", "Data-analyytikko", "expert", "wait")],
    ["demo-sent-2", doc(today, "", "Saaristo Software Oy", "Junior Developer Trainee", "trainee", "wait")],
    // An interview followed by a rejection: the history shows both, and the interview keeps its XP.
    [
      "demo-hist-1",
      doc(addDays(today, -24), "", "Revontuli Insight Oy", "BI-analyytikko", "expert", "no", [
        { status: "int", d: addDays(today, -14) },
        { status: "no", d: addDays(today, -3) },
      ]),
    ],
    [
      "demo-todo-1",
      doc(addDays(today, -2), fmtDate(addDays(today, 3)), "Kuusikko Data Oy", "Junior Data Analyst", "expert", "todo"),
    ],
    [
      "demo-todo-2",
      doc(addDays(today, -5), fmtDate(addDays(today, 12)), "Pikselipaja Studios", "QA Trainee", "trainee", "todo"),
    ],
  ];
}
