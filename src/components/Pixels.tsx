// Small pixel art drawn from rows of palette digits ("." is empty), at one SVG unit per pixel.
// Fixed palettes (shields, milestone items) look the same in both themes; the menu icons use currentColor.

export function pixelRects(rows: readonly string[], palette: readonly string[], x = 0, y = 0) {
  return rows.flatMap((row, j) =>
    [...row].map((c, i) =>
      c === "." ? null : <rect key={`${i},${j}`} x={x + i} y={y + j} width={1} height={1} fill={palette[+c]} />,
    ),
  );
}

function Sprite({
  rows,
  palette,
  className,
}: {
  rows: readonly string[];
  palette: readonly string[];
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {pixelRects(rows, palette)}
    </svg>
  );
}

// Menu and list icons, 9×9, one color.
const ICONS = {
  calendar: [
    ".0.....0.",
    "000000000",
    "000000000",
    "0.......0",
    "0.0.0.0.0",
    "0.......0",
    "0.0.0.0.0",
    "0.......0",
    "000000000",
  ],
  shield: [
    "000000000",
    "000000000",
    "00.....00",
    "00.....00",
    "00.....00",
    ".00...00.",
    ".00...00.",
    "..00.00..",
    "...000...",
  ],
  list: [
    ".........",
    "00.000000",
    ".........",
    ".........",
    "00.000000",
    ".........",
    ".........",
    "00.000000",
    ".........",
  ],
  bars: [
    "......00.",
    "......00.",
    "...00.00.",
    "...00.00.",
    "00.00.00.",
    "00.00.00.",
    "00.00.00.",
    "00.00.00.",
    "000000000",
  ],
  clock: [
    "..00000..",
    ".0.....0.",
    "0...0...0",
    "0...0...0",
    "0...000.0",
    "0.......0",
    "0.......0",
    ".0.....0.",
    "..00000..",
  ],
  lock: ["..000..", ".0...0.", ".0...0.", "0000000", "000.000", "000.000", "0000000"],
  check: ["......0", ".....00", "0...00.", "00.00..", ".000...", "..0...."],
  plus: ["...0...", "...0...", "...0...", "0000000", "...0...", "...0...", "...0..."],
  // arrowheads: only on controls that open content below them
  right: ["0....", "00...", ".00..", "..00.", "...00", "..00.", ".00..", "00...", "0...."],
  down: ["0.......0", "00.....00", ".00...00.", "..00.00..", "...000...", "....0...."],
} as const;
export type IconName = keyof typeof ICONS;

export function PixelIcon({ name }: { name: IconName }) {
  return <Sprite className={`pxicon pxicon-${name}`} rows={ICONS[name]} palette={["currentColor"]} />;
}

// Application milestone items, 12 pixels wide.
const OUTLINE = "#2e2420";
const MILESTONE_ITEMS: Record<string, { palette: string[]; rows: string[] }> = {
  // first application: a sealed envelope
  first: {
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
  // ten: a messenger bag with a strap and buckle
  ten: {
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
  // 25: a rubber postmark stamp on its ink pad
  quarter: {
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
  // Puolisataa: a post box with its slot, on a post
  fifty: {
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
};

export function MilestoneItem({ id }: { id: string }) {
  const item = MILESTONE_ITEMS[id];
  return item ? <Sprite className="ms-sprite" rows={item.rows} palette={item.palette} /> : null;
}
