// The post series' pixel items (lib/post.ts): a 12-pixel-wide picture for Varusteet and a small one the avatar
// carries in its right hand, on the avatar's own pixel grid. Colors are fixed like the avatar's.
import type { PostItemId } from "../lib/post";
import { pixelRects, Sprite } from "./Pixels";

const OUTLINE = "#2e2420";
type Art = { palette: string[]; rows: string[] };

const ITEMS: Record<PostItemId, Art> = {
  // Kirjekuori (1): a sealed envelope
  envelope: {
    palette: [OUTLINE, "#eee3c6", "#c9b98f", "#c0573e"],
    rows: [
      "000000000000",
      "021111111120",
      "012111111210",
      "011211112110",
      "011123321110",
      "011112211110",
      "011111111110",
      "011111111110",
      "000000000000",
    ],
  },
  // Lähettilaukku (10): a messenger bag with a strap and buckle
  satchel: {
    palette: [OUTLINE, "#8e5a32", "#b9824d", "#d8b655", "#5e3b22"],
    rows: [
      "...000000...",
      "..04....40..",
      ".04......40.",
      "000000000000",
      "022222222220",
      "022222222220",
      "011113311110",
      "011111111110",
      "011111111110",
      "000000000000",
    ],
  },
  // Postileimasin (25): a rubber postmark stamp on its ink pad
  postmark: {
    palette: [OUTLINE, "#a0603f", "#cf9b5c", "#8e8a80", "#3e7377"],
    rows: [
      "....0000....",
      "...022110...",
      "...021110...",
      "....0110....",
      "....0110....",
      "..00000000..",
      ".0333333330.",
      "000000000000",
      "044444444440",
      "000000000000",
    ],
  },
  // Puolisataa-postilaatikko (50): a post box with its slot, on a post
  postbox: {
    palette: [OUTLINE, "#e08a2e", "#f2b45c", "#3b2a1e", "#8e5a32", "#eef0e8"],
    rows: [
      "..00000000..",
      ".0222222220.",
      ".0211111110.",
      ".0033333300.",
      ".0111111110.",
      ".0111551110.",
      ".0111111110.",
      ".0111111110.",
      "..00000000..",
      "....0440....",
      "....0440....",
    ],
  },
  // Postikärry (100): a red post trolley with two parcels
  cart: {
    palette: [OUTLINE, "#c0573e", "#cf9b5c", "#8e8a80", "#e9d9b0"],
    rows: [
      "0...........",
      "0...........",
      ".0.00000000.",
      ".0.02240220.",
      ".0.02240220.",
      ".0.00000000.",
      ".01111111110",
      ".00000000000",
      "..000..000..",
      "..030..030..",
      "..000..000..",
    ],
  },
  // Tavarafillari (200): a long-john cargo bike, the box between the handlebar and the front wheel
  cargobike: {
    palette: [OUTLINE, "#3e7377", "#62a8a3", "#e08a2e", "#8e8a80"],
    rows: [
      ".....00..00.",
      "......3...3.",
      "000000.3..3.",
      "011210..3.3.",
      "012110...33.",
      "000000333333",
      "..3.......3.",
      ".00......00.",
      "0440....0440",
      "0440....0440",
      ".00......00.",
    ],
  },
};

// Small versions held in the avatar's right hand: 5 or 6 pixels wide, standing on the floor (row 15).
const HELD: Record<PostItemId, Art> = {
  envelope: { palette: [OUTLINE, "#eee3c6", "#c9b98f", "#c0573e"], rows: ["00000", "02120", "01310", "00000"] },
  satchel: {
    palette: [OUTLINE, "#8e5a32", "#b9824d", "#d8b655"],
    rows: [".000.", ".0.0.", "00000", "02320", "01110", "00000"],
  },
  postmark: {
    palette: [OUTLINE, "#a0603f", "#cf9b5c", "#3e7377"],
    rows: [".000.", ".021.", "..1..", "00000", "03330", "00000"],
  },
  postbox: {
    palette: [OUTLINE, "#e08a2e", "#f2b45c", "#3b2a1e", "#8e5a32"],
    rows: ["00000", "02220", "03330", "01110", "01110", "00000", "..4.."],
  },
  cart: {
    palette: [OUTLINE, "#c0573e", "#cf9b5c", "#8e8a80"],
    rows: ["0.....", "0.000.", "0.020.", "011110", "000000", ".3..3."],
  },
  cargobike: {
    palette: [OUTLINE, "#3e7377", "#62a8a3", "#e08a2e", "#8e8a80"],
    rows: ["...0.3", "0000.3", "0120.3", "000333", "00..00", "04..04"],
  },
};

/** The worn post item on the avatar (16×16 grid), in the right hand. */
export function PostPixels({ id }: { id: PostItemId }) {
  const { palette, rows } = HELD[id];
  return pixelRects(rows, palette, 16 - rows[0].length, 16 - rows.length);
}

/** The post item's picture in Varusteet. */
export function PostIcon({ id }: { id: PostItemId }) {
  const { palette, rows } = ITEMS[id];
  return <Sprite className="ms-sprite" rows={rows} palette={palette} />;
}
