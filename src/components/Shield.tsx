import type { ShieldId } from "../lib/shields";
import { pixelRects } from "./Pixels";

// 7×9 pixel shields drawn at the avatar's own pixel size, so the one worn sits on the character's pixel grid.
// Colors are fixed like the avatar's. Digits index the palette, "." is empty.
const SPRITES: Record<ShieldId, { palette: string[]; rows: string[] }> = {
  // Worn grey iron: chipped top corner, a dent in the right edge, a crack and rust, a crooked point.
  dented: {
    palette: ["#5e4136", "#8e8a80", "#bdb7a9", "#a0603f", "#2e2420"],
    rows: ["00000..", "022140.", "0214110", "021410.", "0114310", ".01340.", ".0130..", "..00...", "..0...."],
  },
  // Round wooden shield with a blue-grey patch stitched on.
  patched: {
    palette: ["#4a3318", "#9b6b38", "#cf9b5c", "#6b4723", "#6f9aa3", "#e9e3c9"],
    rows: ["..000..", ".02320.", "0223120", "0444520", "0444320", "0444510", ".02310.", "..010..", "...0..."],
  },
  // Crenellated top, gold rim and boss on teal steel.
  reinforced: {
    palette: ["#1b2b2d", "#3e7377", "#62a8a3", "#d8b655", "#f6dd95", "#9fd3c9"],
    rows: ["3.333.3", "3333333", "3122213", "3125213", "3224223", ".31213.", ".31213.", "..333..", "...3..."],
  },
};

export function ShieldPixels({ id, x = 0, y = 0 }: { id: ShieldId; x?: number; y?: number }) {
  const { palette, rows } = SPRITES[id];
  return pixelRects(rows, palette, x, y);
}

export function ShieldIcon({ id }: { id: ShieldId }) {
  return (
    <svg viewBox="0 0 7 9" shapeRendering="crispEdges" aria-hidden="true">
      <ShieldPixels id={id} />
    </svg>
  );
}
