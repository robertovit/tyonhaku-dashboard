// 16×16 pixel character (Havu design, level 5 drawn there). It gains an item per level:
// 1 magnifier, 2 pen, 3 laptop, 4 suit and tie, 5 name badge, 6 glasses, 7 crown, 8+ golden glow.
// A shield earned from rejections (lib/shields.ts) can be worn on the left arm, in front of everything else.
// Colors are fixed so the character looks the same in both themes.
import type { ShieldId } from "../lib/shields";
import { ShieldPixels } from "./Shield";

type Px = [x: number, y: number, w: number, h: number, fill: string, opacity?: number];

const HAIR = "#3B2A1E";
const SKIN = "#F1C9A0";
const SKIN_SHADE = "#E2B48A";
const EYE = "#10162E";
const MOUTH = "#C27A5A";
const SHOE = "#141915";
const WHITE = "#EEF0E8";
const LIME = "#C8F169";
const GOLD = "#E8C547";
const GOLD_DARK = "#B8902A";

export function Avatar({ level, shield }: { level: number; shield?: ShieldId }) {
  const n = Math.max(1, level);
  const suit = n >= 4;
  const body = n >= 8 ? GOLD_DARK : suit ? "#44634B" : "#6C8FA0";
  const px: Px[] = [];
  if (n >= 8) {
    px.push([1, 2, 14, 13, GOLD, 0.18]);
    for (const [x, y] of [
      [1, 1],
      [14, 2],
      [1, 9],
      [14, 8],
    ]) {
      px.push([x, y - 1, 1, 3, GOLD], [x - 1, y, 3, 1, GOLD]);
    }
  }
  // head and hair
  px.push(
    [4, 1, 8, 2, HAIR],
    [3, 2, 1, 4, HAIR],
    [12, 2, 1, 3, HAIR],
    [4, 3, 8, 6, SKIN],
    [4, 3, 6, 1, HAIR],
    [6, 5, 1, 2, EYE],
    [9, 5, 1, 2, EYE],
    [7, 7, 2, 1, MOUTH],
    [7, 9, 2, 1, SKIN_SHADE],
  );
  // body, arms, hands, shoes
  px.push(
    [4, 10, 8, 4, body],
    [3, 10, 1, 3, body],
    [12, 10, 1, 3, body],
    [3, 13, 1, 1, SKIN],
    [12, 13, 1, 1, SKIN],
    [5, 14, 2, 2, SHOE],
    [9, 14, 2, 2, SHOE],
  );
  if (suit) px.push([6, 10, 4, 1, WHITE], [7, 11, 1, 3, n >= 8 ? "#44634B" : LIME]);
  else px.push([6, 10, 4, 1, "#88AEBD"]);
  if (n >= 5) px.push([9, 11, 1, 1, "#93B1BA"], [9, 12, 2, 2, WHITE]);
  if (n >= 6)
    px.push([5, 4, 2, 1, SHOE], [9, 4, 2, 1, SHOE], [7, 5, 2, 1, SHOE], [5, 6, 1, 1, SHOE], [10, 6, 1, 1, SHOE]);
  if (n >= 2) px.push([13, 2, 1, 3, "#D4C07A"], [13, 1, 1, 1, MOUTH], [13, 5, 1, 1, "#3B2A1E"]);
  if (n >= 7)
    px.push([4, 0, 8, 1, GOLD], [4, -1, 1, 1, GOLD], [7, -1, 2, 1, GOLD], [11, -1, 1, 1, GOLD], [7, 0, 2, 1, MOUTH]);
  if (n === 3) px.push([2, 12, 12, 4, "#A9B5AC"], [3, 12, 10, 3, "#27362D"], [7, 13, 2, 1, "#93B1BA"]);
  if (n === 1)
    px.push(
      [13, 8, 2, 1, "#A9B5AC"],
      [12, 9, 1, 2, "#A9B5AC"],
      [15, 9, 1, 2, "#A9B5AC"],
      [13, 11, 2, 1, "#A9B5AC"],
      [13, 9, 2, 2, "#DDEBF0", 0.7],
      [12, 12, 1, 1, "#7A5A3A"],
    );
  return (
    <svg viewBox="0 -1 16 17" shapeRendering="crispEdges" aria-hidden="true">
      {px.map(([x, y, w, h, fill, opacity], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} />
      ))}
      {shield && <ShieldPixels id={shield} x={0} y={7} />}
    </svg>
  );
}
