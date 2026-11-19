import { scaleLinear } from "@visx/scale";
import type { ReactNode } from "react";
import { useChartTooltip } from "./Tooltip";
import { useWidth } from "../../hooks/useWidth";

export interface HBarRow {
  key: string;
  label: ReactNode;
  value: number;
  valueLabel?: string;
  tone?: "accent" | "muted";
  note?: string;
  tip?: ReactNode;
}

const ROW_H = 26;
const BAR_H = 16;

/** Horizontal bars: HTML labels on the left, one SVG with a shared linear scale on the right. */
export function HBarChart({
  rows,
  labelWidth = 220,
  gutter = 130,
  ariaLabel,
}: {
  rows: HBarRow[];
  labelWidth?: number;
  gutter?: number;
  ariaLabel: string;
}) {
  const tip = useChartTooltip();
  const [plotRef, width] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div
      className="hbar"
      data-chart
      ref={tip.containerRef}
      style={{ gridTemplateColumns: `minmax(0, ${labelWidth}px) minmax(0, 1fr)` }}
    >
      <div className="hbar-labels">
        {rows.map((r) => (
          <div key={r.key} className="hbar-label" style={{ height: ROW_H }}>
            {r.label}
          </div>
        ))}
      </div>
      <div className="hbar-plot" ref={plotRef}>
        {width > 0 &&
          (() => {
            const x = scaleLinear({ domain: [0, max], range: [0, Math.max(0, width - gutter)] });
            return (
              <svg width={width} height={rows.length * ROW_H} role="img" aria-label={ariaLabel}>
                {rows.map((r, i) => {
                  const w = Math.max(r.value > 0 ? 3 : 0, x(r.value));
                  const y = i * ROW_H + (ROW_H - BAR_H) / 2;
                  return (
                    <g
                      key={r.key}
                      onMouseMove={r.tip ? (e) => tip.show(e, r.tip) : undefined}
                      onMouseLeave={tip.hide}
                      className="hbar-row"
                    >
                      <rect x={0} y={i * ROW_H} width={width} height={ROW_H} className="hit" />
                      <path
                        className={`bar grow-x ${r.tone === "accent" ? "bar-accent" : "bar-base"}`}
                        d={rightRounded(0, y, w, BAR_H, 4)}
                      />
                      <text x={w + 8} y={y + BAR_H / 2} dy="0.35em" className="bar-value">
                        {r.valueLabel ?? r.value}
                        {r.note && (
                          <tspan className="bar-note" dx={10}>
                            {r.note}
                          </tspan>
                        )}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
      </div>
      {tip.node}
    </div>
  );
}

/** Rect with only its data end (right side) rounded; the baseline end stays square. */
export function rightRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - rr)}z`;
}
/** Rect with only its top rounded (vertical bars anchored to the baseline). */
export function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}v${-(h - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}z`;
}
