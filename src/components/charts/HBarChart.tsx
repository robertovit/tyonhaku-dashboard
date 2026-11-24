import { scaleLinear } from "@visx/scale";
import type { ReactNode } from "react";
import { useChartTooltip } from "./Tooltip";

export interface HBarRow {
  key: string;
  label: ReactNode;
  value: number;
  valueLabel?: string;
  /** CSS color of the fill; the accent by default. */
  color?: string;
  note?: string;
  tip?: ReactNode;
}

/**
 * Horizontal bars in the Havu style: label, a bordered track with the fill, the value in a fixed column.
 * Plain HTML rows so the label wraps above the bar on narrow screens; the visx scale keeps one shared x.
 */
export function HBarChart({ rows, ariaLabel }: { rows: HBarRow[]; ariaLabel: string }) {
  const tip = useChartTooltip();
  const x = scaleLinear({ domain: [0, Math.max(1, ...rows.map((r) => r.value))], range: [0, 100] });
  return (
    <div data-chart ref={tip.containerRef}>
      <ul className="bars" aria-label={ariaLabel}>
        {rows.map((r) => (
          <li
            key={r.key}
            className="bar-row"
            onMouseMove={r.tip ? (e) => tip.show(e, r.tip) : undefined}
            onMouseLeave={r.tip ? tip.hide : undefined}
          >
            <span className="bar-label">{r.label}</span>
            <span className="bar-plot">
              <span className="bar-track" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{
                    width: `${r.value > 0 ? Math.max(1.5, x(r.value)) : 0}%`,
                    background: r.color ?? "var(--accent)",
                  }}
                />
              </span>
              <span className="bar-val">{r.valueLabel ?? r.value}</span>
            </span>
            {r.note && <span className="bar-note">{r.note}</span>}
          </li>
        ))}
      </ul>
      {tip.node}
    </div>
  );
}
