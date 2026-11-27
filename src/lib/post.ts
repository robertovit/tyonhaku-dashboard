// The post series: cosmetic items earned from sent applications, worn beside the shield. Like the rest of the
// game they are derived from the applications (GameState.total: every sent application counts once, whatever
// its status later becomes) and give no XP of their own. The worn item is a per-browser choice
// (hooks/useGear.ts). `id` is the stable key stored for that choice; names and texts are display only.

export const POST_ITEMS = [
  { id: "envelope", milestone: "first", required: 1, name: "Kirjekuori" },
  { id: "satchel", milestone: "ten", required: 10, name: "Lähettilaukku" },
  { id: "postmark", milestone: "quarter", required: 25, name: "Postileimasin" },
  { id: "postbox", milestone: "fifty", required: 50, name: "Puolisataa-postilaatikko" },
  { id: "cart", milestone: "hundred", required: 100, name: "Postikärry" },
  { id: "cargobike", milestone: "twohundred", required: 200, name: "Tavarafillari" },
] as const;

export type PostItem = (typeof POST_ITEMS)[number];
export type PostItemId = PostItem["id"];

/** The unlock message's title; the cart admits it came late. */
const UNLOCKED: Partial<Record<PostItemId, string>> = {
  cart: "Postikärry avattu. Olisi pitänyt hankkia tämä aiemmin.",
};
export const unlockedTitle = (item: PostItem) => UNLOCKED[item.id] ?? `${item.name} avattu`;

/** "1 hakemus", "50 hakemusta" */
export const sentText = (n: number) => `${n} ${n === 1 ? "hakemus" : "hakemusta"}`;

/** Post items earned with `total` sent applications. */
export const earnedPostItems = (total: number) => POST_ITEMS.filter((p) => total >= p.required);

/** The highest post item that `after` sent applications reach and `before` did not, if any. */
export function newlyUnlockedPost(before: number, after: number): PostItem | undefined {
  return POST_ITEMS.filter((p) => before < p.required && after >= p.required).at(-1);
}

/** The chosen post item, if it is a real one and still earned. */
export function equippedPost(id: string | null, total: number): PostItem | undefined {
  return POST_ITEMS.find((p) => p.id === id && total >= p.required);
}
