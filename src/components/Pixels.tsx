// Small pixel art drawn from rows of palette digits ("." is empty), at one SVG unit per pixel.
// Fixed palettes (shields, post items) look the same in both themes; the menu icons use currentColor.

export function pixelRects(rows: readonly string[], palette: readonly string[], x = 0, y = 0) {
  return rows.flatMap((row, j) =>
    [...row].map((c, i) =>
      c === "." ? null : <rect key={`${i},${j}`} x={x + i} y={y + j} width={1} height={1} fill={palette[+c]} />,
    ),
  );
}

export function Sprite({
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
