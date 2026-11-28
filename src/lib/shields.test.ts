import { describe, expect, it } from "vitest";
import { ARCHIVED_BADGES, celebrationFor, celebrationWatch, COLLECTION_BADGES, gameState } from "./game";
import { recordStatus, withoutStage } from "./history";
import { normalize, toDoc, type Application, type ApplicationDoc, type Status } from "./model";
import { equippedShield, newlyUnlockedShield } from "./shields";
import { webStore } from "./web";

const today = "2026-11-27";
const sent = (i: number) =>
  normalize(`a${i}`, { schema: 2, d: "2026-10-01", org: `Yritys ${i} Oy`, att: "CV", status: "wait" }, today);
/** A normal status update, as the edit dialog and the Today quick rejection save it. */
const setStatus = (a: Application, status: Status, d = "2026-11-20") =>
  normalize(a.id, { ...toDoc(a), status, events: recordStatus(a.events, status, d) }, today);
/** `n` applications already rejected, plus one still waiting (the last). */
const apps = (n: number) => [...Array.from({ length: n }, (_, i) => setStatus(sent(i), "no")), sent(n)];
const g = (list: Application[]) => gameState(list, 99, today); // no weekly bonus in the sums
/** The game before and after the waiting application is marked rejected. */
const rejectLast = (list: Application[], status: Status = "no") => {
  const after = [...list.slice(0, -1), setStatus(list.at(-1)!, status)];
  return { after, c: celebrationFor(g(list), g(after)) };
};

describe("rejection shields", () => {
  it.each([
    [0, "dented", "Kolhiintunut kilpi"],
    [4, "patched", "Paikattu kilpi"],
    [9, "reinforced", "Vahvistettu kilpi"],
  ])("after %i rejections the next one opens a shield, calmly and with the usual XP", (n, id, name) => {
    const { c } = rejectLast(apps(n));
    expect(c).toMatchObject({ title: `${name} avattu`, text: "+3 XP", confetti: 0, shield: { id } });
  });

  it("opens nothing between the milestones", () => {
    for (const n of [1, 3, 5, 8, 10, 20]) {
      const { c } = rejectLast(apps(n));
      expect(c?.shield, `rejection ${n + 1}`).toBeUndefined();
      expect(c).toMatchObject({ title: "+3 XP", confetti: 0 });
    }
  });

  it("counts an application once: saving the same rejection again adds nothing", () => {
    const list = apps(5);
    const again = list.map((a) => (a.status === "no" ? setStatus(a, "no", today) : a));
    expect(again[0].events).toEqual(list[0].events);
    expect(g(again).no).toBe(5);
    expect(celebrationFor(g(list), g(again))).toBeNull();
    // waiting → no → waiting → no is still one rejection
    const back = setStatus(setStatus(list[0], "wait"), "no", today);
    expect(g([back, ...list.slice(1)]).no).toBe(5);
  });

  it("opens a shield from a rejection after an interview", () => {
    const int = setStatus(sent(0), "int", "2026-11-10");
    const c = celebrationFor(g([int]), g([setStatus(int, "no")]));
    expect(c).toMatchObject({
      title: "Kolhiintunut kilpi avattu",
      text: "+3 XP",
      confetti: 0,
      shield: { id: "dented" },
    });
  });

  it("keeps the confetti away from a rejection, even when it also raises the level", () => {
    // 9 rejected (13 XP each) + 13 waiting (10 XP) = 247 XP; the next rejection reaches 250 XP (level 3)
    const list = [...apps(9).slice(0, -1), ...Array.from({ length: 13 }, (_, i) => sent(20 + i))];
    const before = g(list);
    const { after, c } = rejectLast(list);
    expect(g(after).level.n).toBeGreaterThan(before.level.n);
    expect(c).toMatchObject({ confetti: 0, shield: { id: "reinforced" } });
    expect(c!.text).toMatch(/^\+3 XP · Taso/);
  });

  it("lets go of a shield that a correction takes back", () => {
    const list = apps(1);
    const fixed = normalize(list[0].id, { ...toDoc(list[0]), ...withoutStage(list[0], "no") }, today);
    expect(g([fixed]).no).toBe(0);
    expect(equippedShield("dented", g([fixed]).no)).toBeUndefined();
  });

  it("wears only earned, known shields; earlier ones stay wearable", () => {
    expect(equippedShield("dented", 10)?.name).toBe("Kolhiintunut kilpi");
    expect(equippedShield("patched", 4)).toBeUndefined();
    expect(equippedShield("nope", 10)).toBeUndefined();
    expect(equippedShield(null, 10)).toBeUndefined();
    expect(newlyUnlockedShield(0, 12)?.id).toBe("reinforced");
    expect(newlyUnlockedShield(5, 4)).toBeUndefined();
  });
});

describe("the collection", () => {
  it("keeps the application count badges and puts the shields in place of Sinnikäs", () => {
    const ids = COLLECTION_BADGES.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["first", "ten", "quarter", "fifty"]));
    expect(ids).not.toContain("persist");
    expect(ARCHIVED_BADGES.map((b) => b.id)).toEqual(["burst", "bigwater", "interview", "top", "offer"]);
  });
  it("shows an interview as XP, not as a new badge", () => {
    const c = celebrationFor(g([sent(0)]), g([setStatus(sent(0), "int")]));
    expect(c).toMatchObject({ title: "+50 XP", newBadges: [] });
    expect(c!.text).not.toMatch(/saavutus/);
    expect(g([setStatus(sent(0), "int")]).badges).toContain("interview"); // still earned, under "Aiemmin ansaitut"
  });
});

describe("when the unlock is shown", () => {
  const ten = apps(9);
  it("opens earlier shields silently on the first visit", () => {
    const watch = celebrationWatch();
    expect(watch.see(g(apps(12)), false)).toBeNull();
  });
  it("waits for the confirmed save, and shows nothing when the save fails", async () => {
    const server = (fail: boolean) =>
      (async (url: string, init?: RequestInit) => {
        if (url === "/api/applications" && !init?.method)
          return Response.json({ items: ten.map((a) => ({ id: a.id, doc: toDoc(a) })) });
        if (url === "/api/settings/goal") return Response.json({ weekly: 20 });
        return fail ? Response.json({ error: "Tallennus epäonnistui." }, { status: 500 }) : Response.json({});
      }) as unknown as typeof fetch;
    const run = async (fail: boolean) => {
      const store = webStore(server(fail));
      const watch = celebrationWatch();
      const shown: unknown[] = [];
      store.subscribe({
        onApps: (list, pending) => {
          const c = watch.see(g(list), pending);
          if (c) shown.push(c);
        },
        onGoal() {},
        onError() {},
      });
      await new Promise((r) => setTimeout(r, 0));
      const last = ten.at(-1)!;
      const patch: Partial<ApplicationDoc> = { status: "no", events: recordStatus(last.events, "no", today) };
      watch.arm();
      await store.update(last.id, patch).catch(() => {});
      return shown;
    };
    expect(await run(true)).toEqual([]);
    expect(await run(false)).toEqual([expect.objectContaining({ title: "Vahvistettu kilpi avattu", confetti: 0 })]);
  });
  it("names the save in the message: the XP that came true, or the shield with it", () => {
    const one = sent(0);
    expect(celebrationFor(g([one]), g([setStatus(one, "no")]), "Hylkäys kirjattu")).toMatchObject({
      title: "Kolhiintunut kilpi avattu",
      text: expect.stringMatching(/^Hylkäys kirjattu · \+3 XP/),
    });
    const ten = apps(10);
    const last = ten.at(-1)!;
    const after = [...ten.slice(0, -1), setStatus(last, "int")];
    expect(celebrationFor(g(ten), g(after), "Haastattelu kirjattu")?.title).toBe("Haastattelu kirjattu · +50 XP");
    // nothing gained and no shield: still nothing to show
    expect(celebrationFor(g(ten), g(ten), "Tila päivitetty")).toBeNull();
  });
});
