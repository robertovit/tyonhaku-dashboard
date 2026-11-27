// Shields earned from recorded rejections. Like the rest of the game they are derived from the applications
// (GameState.no: applications whose history has a rejection, each counted once) and give no XP of their own.
// Which shield the avatar wears is a per-browser choice (hooks/useShield.ts).

export const SHIELDS = [
  { id: "dented", name: "Kolhiintunut kilpi", required: 1 },
  { id: "patched", name: "Paikattu kilpi", required: 5 },
  { id: "reinforced", name: "Vahvistettu kilpi", required: 10 },
] as const;

export type Shield = (typeof SHIELDS)[number];
export type ShieldId = Shield["id"];

/** "1 hylkäys", "5 hylkäystä" */
export const rejectionsText = (n: number) => `${n} ${n === 1 ? "hylkäys" : "hylkäystä"}`;

/** The highest shield that `after` rejections reach and `before` did not, if any. */
export function newlyUnlockedShield(before: number, after: number): Shield | undefined {
  return SHIELDS.filter((s) => before < s.required && after >= s.required).at(-1);
}

/** The chosen shield, if it is a real one and still earned. */
export function equippedShield(id: string | null, rejections: number): Shield | undefined {
  return SHIELDS.find((s) => s.id === id && rejections >= s.required);
}
