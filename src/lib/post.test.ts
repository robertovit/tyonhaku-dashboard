import { describe, expect, it } from "vitest";
import { celebrationFor, gameState } from "./game";
import { recordStatus } from "./history";
import { normalize, toDoc, type Application, type Status } from "./model";
import { earnedPostItems, equippedPost, newlyUnlockedPost, POST_ITEMS } from "./post";

const today = "2026-11-27";
const sent = (i: number) =>
  normalize(`a${i}`, { schema: 2, d: "2026-09-01", org: `Yritys ${i} Oy`, status: "wait" }, today);
const setStatus = (a: Application, status: Status) =>
  normalize(a.id, { ...toDoc(a), status, events: recordStatus(a.events, status, "2026-11-20") }, today);
const many = (n: number) => Array.from({ length: n }, (_, i) => sent(i));
const g = (list: Application[]) => gameState(list, 99, today);

describe("post series", () => {
  it("opens items at 1, 10, 25, 50, 100 and 200 sent applications", () => {
    expect(POST_ITEMS.map((p) => p.required)).toEqual([1, 10, 25, 50, 100, 200]);
    expect(POST_ITEMS.map((p) => p.name)).toEqual([
      "Kirjekuori",
      "Lähettilaukku",
      "Postileimasin",
      "Puolisataa-postilaatikko",
      "Postikärry",
      "Tavarafillari",
    ]);
    expect(earnedPostItems(0)).toEqual([]);
    expect(earnedPostItems(49).map((p) => p.id)).toEqual(["envelope", "satchel", "postmark"]);
    expect(earnedPostItems(50).at(-1)?.id).toBe("postbox");
  });

  it("counts each sent application once, whatever its status becomes later", () => {
    const list = many(50);
    const updated = list.map((a, i) => (i % 3 === 0 ? setStatus(setStatus(a, "int"), "no") : a));
    expect(g(updated).total).toBe(50);
    expect(earnedPostItems(g(updated).total)).toHaveLength(4);
    // a saved ad is not sent: it counts once it is marked applied
    const todo = normalize("t", { org: "Talteen Oy", status: "todo", d: today }, today);
    expect(g([...list.slice(0, 49), todo].filter((a) => a.status !== "todo")).total).toBe(49);
  });

  it("gives old data its items at once (no message on load)", () => {
    // someone with 50 applications opening the new version: the state already has the items
    expect(earnedPostItems(g(many(50)).total).map((p) => p.id)).toContain("postbox");
    expect(newlyUnlockedPost(50, 50)).toBeUndefined();
  });

  it("announces the item a save reaches: 49 → 50 and the cart at 100", () => {
    const c = celebrationFor(g(many(49)), g(many(50)), "Merkitty haetuksi")!;
    expect(c.post?.id).toBe("postbox");
    expect(c.title).toBe("Puolisataa-postilaatikko avattu");
    expect(c.text).toMatch(/^Merkitty haetuksi · \+10 XP/);
    const cart = celebrationFor(g(many(99)), g(many(100)))!;
    expect(cart.title).toBe("Postikärry avattu. Olisi pitänyt hankkia tämä aiemmin.");
    // a status update adds no sent application: no post item
    const list = many(50);
    expect(celebrationFor(g(list), g([...list.slice(1), setStatus(list[0], "int")]))?.post).toBeUndefined();
  });

  it("keeps the stored choice apart from names: an unknown or unearned id wears nothing", () => {
    expect(equippedPost("postbox", 50)?.name).toBe("Puolisataa-postilaatikko");
    expect(equippedPost("postbox", 49)).toBeUndefined();
    expect(equippedPost("Puolisataa-postilaatikko", 50)).toBeUndefined();
    expect(equippedPost(null, 50)).toBeUndefined();
  });
});
