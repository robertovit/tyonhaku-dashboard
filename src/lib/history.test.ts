import { afterEach, describe, expect, it, vi } from "vitest";
import { normalize, toDoc, type Application, type ApplicationDoc, type Status } from "./model";
import { asOf, recordStatus, timeline, withEarlierInterview, withoutStage, withStageDate } from "./history";
import { badgeWeeks, celebrationFor, gameState, statusGain, xpForApp } from "./game";
import { countBy, funnel, summary } from "./stats";
import { parseBackup, toBackup } from "./backup";
import { memoryBackend } from "./memory";

const today = "2026-11-27";
const sent = normalize(
  "h1",
  { schema: 2, d: "2026-11-03", org: "Esimerkki Oy", role: "Analyytikko", att: "CV", status: "wait" },
  today,
);
/** A normal status update, as the edit dialog and the quick actions save it. */
const setStatus = (a: Application, status: Status, d: string, extra: Partial<ApplicationDoc> = {}) =>
  normalize(a.id, { ...toDoc(a), ...extra, status, events: recordStatus(a.events, status, d) }, today);
/** The stored document read back, as after a reload. */
const reload = (a: Application) => normalize(a.id, JSON.parse(JSON.stringify(toDoc(a))), today);
const g = (apps: Application[]) => gameState(apps, 5, today);

describe("interview, then rejection", () => {
  const int = setStatus(sent, "int", "2026-11-15");
  const no = setStatus(int, "no", "2026-11-20");

  it("keeps the interview XP: 10 → 60 → 63", () => {
    expect([sent, int, no].map(xpForApp)).toEqual([10, 60, 63]);
  });
  it("forecasts and gains the same +3 XP", () => {
    expect(statusGain(int, "no")).toBe(3);
    expect(g([no]).xp - g([int]).xp).toBe(3);
    // the first rejection also opens the first shield (lib/shields.ts)
    expect(celebrationFor(g([int]), g([no]))).toMatchObject({ text: "+3 XP", confetti: 0, shield: { id: "dented" } });
  });
  it("shows one row with the current status, and the interview in the funnel and badges", () => {
    expect(countBy([no])).toMatchObject({ no: 1, int: 0 });
    expect(funnel([no]).map((r) => r.value)).toEqual([1, 1, 1, 0]);
    expect(summary([no]).interviews).toHaveLength(1);
    expect(g([no]).badges).toContain("interview");
    expect(g([no])).toMatchObject({ interviews: 1, no: 1 });
  });
  it("lists the history with the send date apart from the later days", () => {
    expect(timeline(no).map((r) => [r.d, r.label])).toEqual([
      ["2026-11-03", "Hakemus lähetetty"],
      ["2026-11-15", "Haastattelu"],
      ["2026-11-20", "Ei valittu"],
    ]);
    expect(no.d).toBe("2026-11-03");
  });
  it("survives a reload", () => {
    expect(reload(no).events).toEqual(no.events);
    expect(xpForApp(reload(no))).toBe(63);
  });
  it("dates the interview badge to the interview week", () => {
    const w = badgeWeeks([no], 5, today);
    expect(w.first).toBe(45); // 3.11.
    expect(w.interview).toBe(46); // 15.11., not the week the application was sent
  });
  it("reads the application as it was on a past day", () => {
    expect(asOf(no, "2026-11-16")).toMatchObject({ status: "int", events: [{ status: "int" }] });
    expect(asOf(no, "2026-11-10")).toMatchObject({ status: "wait", events: [] });
  });
});

describe("other paths", () => {
  it("a rejection without an interview: 13 XP, no interviews", () => {
    const no = setStatus(sent, "no", "2026-11-20");
    expect(xpForApp(no)).toBe(13);
    expect(g([no]).interviews).toBe(0);
    expect(funnel([no]).map((r) => r.value)).toEqual([1, 1, 0, 0]);
  });
  it("an offer after an interview, or recorded directly: 260 XP, no made-up interview day", () => {
    const viaInt = setStatus(setStatus(sent, "int", "2026-11-15"), "offer", "2026-11-25");
    const direct = setStatus(sent, "offer", "2026-11-25");
    expect(xpForApp(viaInt)).toBe(260);
    expect(xpForApp(direct)).toBe(260);
    expect(direct.events).toEqual([{ status: "offer", d: "2026-11-25" }]);
    expect(funnel([direct]).map((r) => r.value)).toEqual([1, 1, 1, 1]);
  });
  it("a saved ad gives 0 XP; marking it applied gives the send XP once", () => {
    const todo = normalize("t1", { org: "Haettava Oy", status: "todo", d: "2026-11-01", att: "CV" }, today);
    expect(xpForApp(todo)).toBe(0);
    const applied = setStatus(todo, "wait", "", { d: today });
    expect(xpForApp(applied)).toBe(10);
    expect(xpForApp(setStatus(applied, "wait", ""))).toBe(10);
    expect(applied.events).toEqual([]);
  });
  it("saving the same status again or editing other fields adds nothing", () => {
    const int = setStatus(sent, "int", "2026-11-15");
    const again = setStatus(int, "int", "2026-11-27", { note: "toinen kierros" });
    expect(again.events).toEqual([{ status: "int", d: "2026-11-15" }]);
    expect(xpForApp(again)).toBe(60);
    expect(funnel([again])).toEqual(funnel([int]));
    // int → wait → int: still one interview
    const back = setStatus(setStatus(int, "wait", ""), "int", "2026-11-27");
    expect(back.events).toHaveLength(1);
    expect(g([back]).xp).toBe(g([int]).xp);
  });
  it("the Today quick rejection keeps the interview when it was set back to waiting", () => {
    const waiting = setStatus(setStatus(sent, "int", "2026-11-15"), "wait", "");
    expect(statusGain(waiting, "no")).toBe(3);
    expect(xpForApp(setStatus(waiting, "no", today))).toBe(63);
  });
});

describe("correcting the history", () => {
  it("removing a wrong interview takes it out of XP, badges and the funnel", () => {
    const int = setStatus(sent, "int", "2026-11-15");
    const fixed = normalize(int.id, { ...toDoc(int), ...withoutStage(int, "int") }, today);
    expect(fixed).toMatchObject({ status: "wait", events: [] });
    expect(xpForApp(fixed)).toBe(10);
    expect(g([fixed]).badges).not.toContain("interview");
    expect(funnel([fixed]).map((r) => r.value)).toEqual([1, 0, 0, 0]);
    expect(xpForApp(reload(fixed))).toBe(10);
  });
  it("removing a wrong interview before a rejection keeps the rejection", () => {
    const no = setStatus(setStatus(sent, "int", "2026-11-15"), "no", "2026-11-20");
    const fixed = normalize(no.id, { ...toDoc(no), ...withoutStage(no, "int") }, today);
    expect(fixed).toMatchObject({ status: "no", events: [{ status: "no", d: "2026-11-20" }] });
    expect(xpForApp(fixed)).toBe(13);
    expect(g([fixed]).interviews).toBe(0);
  });
  it("removing the current status goes back to the previous stage", () => {
    const no = setStatus(setStatus(sent, "int", "2026-11-15"), "no", "2026-11-20");
    expect(withoutStage(no, "no")).toEqual({ status: "int", events: [{ status: "int", d: "2026-11-15" }] });
  });
  it("changes a day, or adds an interview that was not recorded", () => {
    const no = setStatus(sent, "no", "2026-11-20");
    expect(withStageDate(no.events, "no", "2026-11-19")).toEqual([{ status: "no", d: "2026-11-19" }]);
    const added = withEarlierInterview(no.events, "");
    expect(added.map((e) => e.status)).toEqual(["int", "no"]);
    expect(xpForApp({ ...no, events: added })).toBe(63);
  });
});

describe("data from before the history", () => {
  const old = (status: string) =>
    normalize("old", { schema: 1, d: "2026-08-01", org: "Vanha Oy", att: "CV", status, cv: "", note: "" }, today);
  it("keeps known stages and points, with unknown days", () => {
    expect(old("int").events).toEqual([{ status: "int", d: "" }]);
    expect(xpForApp(old("int"))).toBe(60);
    expect(old("offer").events).toEqual([{ status: "offer", d: "" }]);
    expect(xpForApp(old("offer"))).toBe(260);
    expect(old("wait").events).toEqual([]);
  });
  it("leaves it open whether an old rejection had an interview", () => {
    expect(old("no").events).toEqual([{ status: "no", d: "" }]);
    expect(xpForApp(old("no"))).toBe(13);
    expect(g([old("no")]).interviews).toBe(0);
  });
  it("an old rejection marked after an interview keeps the interview", () => {
    const no = setStatus(old("int"), "no", "2026-11-20");
    expect(no.events).toEqual([
      { status: "int", d: "" },
      { status: "no", d: "2026-11-20" },
    ]);
    expect(xpForApp(no)).toBe(63);
  });
  it("cleans broken history entries", () => {
    const a = normalize(
      "x",
      {
        status: "no",
        events: [
          { status: "int", d: "15.11." },
          { status: "int", d: "2026-11-16" },
          { status: "wait", d: "2026-11-17" },
          null,
        ],
      },
      today,
    );
    expect(a.events).toEqual([
      { status: "int", d: "" },
      { status: "no", d: "" },
    ]);
    expect(normalize("t", { status: "todo", events: [{ status: "int", d: "" }] }, today).events).toEqual([]);
  });
});

describe("backup and storage", () => {
  const no = setStatus(setStatus(sent, "int", "2026-11-15"), "no", "2026-11-20");

  it("keeps the history over a JSON backup round trip", () => {
    const b = parseBackup(toBackup([no], 5, "2026-11-27T12:00:00Z"), today);
    expect(b.items[0].doc.events).toEqual(no.events);
    expect(xpForApp(normalize(b.items[0].id, b.items[0].doc as never, today))).toBe(63);
  });
  it("reads an old backup without history", () => {
    const oldFile = JSON.stringify({
      format: "tyonhaku-backup",
      version: 1,
      goal: 5,
      items: [{ id: "a1", doc: { schema: 1, d: "2026-08-01", org: "Vanha Oy", status: "int" } }],
    });
    expect(parseBackup(oldFile, today).items[0].doc.events).toEqual([{ status: "int", d: "" }]);
  });

  afterEach(() => vi.unstubAllGlobals());
  it("keeps the history in the browser (demo) after a reload", async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    });
    const read = (b: ReturnType<typeof memoryBackend>) =>
      new Promise<Application[]>((resolve) => {
        const off = b.store!.subscribe({ onApps: (apps) => (off(), resolve(apps)), onGoal() {}, onError() {} });
      });
    const seedDocs = (): [string, Record<string, unknown>][] => [["h1", { ...toDoc(sent) }]];
    const opts = { seed: seedDocs, storageKey: "t" };
    const first = memoryBackend(opts);
    const int = setStatus(sent, "int", "2026-11-15");
    await first.store!.save("h1", toDoc(int));
    // the Today quick rejection patches status and history
    await first.store!.update("h1", { status: "no", events: recordStatus(int.events, "no", "2026-11-20") });
    const [again] = await read(memoryBackend(opts));
    expect(again.events).toEqual(no.events);
    expect(xpForApp(again)).toBe(63);
  });
});
