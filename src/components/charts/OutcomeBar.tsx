import { STATUS, type Status } from "../../lib/model";
import { useChartTooltip } from "./Tooltip";
import { useWidth } from "../../hooks/useWidth";

const H = 24;
const GAP = 2;

/** 100 % stacked bar of outcomes in a bordered track, with a 2px gap between segments. */
export function OutcomeBar({
  counts,
  order,
  total,
}: {
  counts: Record<Status, number>;
  order: Status[];
  total: number;
}) {
  const tip = useChartTooltip();
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const segs = order.filter((k) => counts[k] > 0);
  return (
    <div data-chart ref={tip.containerRef} className="outcome">
      <div ref={boxRef} style={{ minHeight: H }}>
        {width > 0 &&
          (() => {
            const usable = Math.max(0, width - GAP * (segs.length - 1));
            let x = 0;
            return (
              <svg
                width={width}
                height={H}
                role="img"
                aria-label={segs.map((k) => `${STATUS[k].label} ${counts[k]}`).join(", ")}
              >
                {segs.map((k) => {
                  const w = Math.max(6, (counts[k] / total) * usable);
                  const rect = (
                    <rect
                      key={k}
                      className="grow-x"
                      x={x}
                      y={0}
                      width={w}
                      height={H}
                      style={{ fill: STATUS[k].color }}
                      onMouseMove={(e) =>
                        tip.show(
                          e,
                          <>
                            <b>{STATUS[k].label}</b>
                            <br />
                            {counts[k]} / {total} hakemusta ({Math.round((counts[k] / total) * 100)} %)
                          </>,
                        )
                      }
                      onMouseLeave={tip.hide}
                    />
                  );
                  x += w + GAP;
                  return rect;
                })}
              </svg>
            );
          })()}
      </div>
      {tip.node}
    </div>
  );
}
