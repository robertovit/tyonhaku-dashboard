import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import type { WeekBucket } from "../../lib/stats";
import { useChartTooltip } from "./Tooltip";
import { useWidth } from "../../hooks/useWidth";

const HEIGHT = 210;
const M = { top: 18, right: 30, bottom: 26, left: 30 };

/** Applications per ISO week with the weekly goal as a dashed line. */
export function WeeklyChart({ weeks, goal }: { weeks: WeekBucket[]; goal: number }) {
  const tip = useChartTooltip();
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const yMax = Math.max(4, Math.ceil(Math.max(goal, ...weeks.map((w) => w.count)) / 4) * 4);
  return (
    <div data-chart ref={tip.containerRef} className="weekly">
      <div ref={boxRef} style={{ minHeight: HEIGHT }}>
        {width > 10 &&
          (() => {
            const iw = width - M.left - M.right;
            const ih = HEIGHT - M.top - M.bottom;
            const x = scaleBand({ domain: weeks.map((w) => w.key), range: [0, iw], padding: 0.3 });
            const y = scaleLinear({ domain: [0, yMax], range: [ih, 0] });
            const every = Math.ceil(weeks.length / Math.max(2, Math.floor(iw / 44)));
            const bw = Math.min(32, x.bandwidth());
            return (
              <svg
                width={width}
                height={HEIGHT}
                role="img"
                aria-label={`Hakemuksia viikoittain, tavoite ${goal} viikossa`}
              >
                <Group left={M.left} top={M.top}>
                  <GridRows scale={y} width={iw} numTicks={4} className="grid" />
                  {weeks.map((w) => {
                    const bx = (x(w.key) ?? 0) + (x.bandwidth() - bw) / 2;
                    const h = ih - y(w.count);
                    const met = w.count >= goal;
                    return (
                      <g
                        key={w.key}
                        onMouseMove={(e) =>
                          tip.show(
                            e,
                            <>
                              <b>Vko {w.week}</b>: {w.count} / {goal} hakemusta{met ? " · tavoite saavutettu" : ""}
                              {w.orgs.length > 0 && <br />}
                              {w.orgs.join(", ")}
                              <br />
                              Yhteensä tähän mennessä {w.cumulative}
                            </>,
                          )
                        }
                        onMouseLeave={tip.hide}
                      >
                        <rect className="hit" x={x(w.key)} y={0} width={x.bandwidth()} height={ih} />
                        {w.count > 0 && (
                          <>
                            <rect
                              className={`bar grow-y ${met ? "bar-accent" : "bar-base"}`}
                              x={bx}
                              y={y(w.count)}
                              width={bw}
                              height={h}
                            />
                            <text className="bar-value" x={bx + bw / 2} y={y(w.count) - 6} textAnchor="middle">
                              {w.count}
                            </text>
                          </>
                        )}
                        {w.isNow && (
                          <rect
                            className="now-outline"
                            x={bx - 3}
                            y={Math.min(y(w.count), ih - 4) - 3}
                            width={bw + 6}
                            height={Math.max(h, 4) + 3}
                          />
                        )}
                      </g>
                    );
                  })}
                  <line className="goal-line" x1={0} x2={iw} y1={y(goal)} y2={y(goal)} />
                  <text className="goal-label" x={iw + 4} y={y(goal)} dy="0.35em">
                    {goal}
                  </text>
                  <AxisLeft
                    scale={y}
                    numTicks={4}
                    hideAxisLine
                    hideTicks
                    tickLabelProps={{ className: "tick", textAnchor: "end", dx: -4, dy: "0.33em" }}
                  />
                  <AxisBottom
                    top={ih}
                    scale={x}
                    hideTicks
                    axisLineClassName="baseline"
                    tickFormat={(k) => {
                      const i = weeks.findIndex((w) => w.key === k);
                      return i % every === 0 || i === weeks.length - 1 ? String(weeks[i].week) : "";
                    }}
                    tickLabelProps={{ className: "tick", textAnchor: "middle", dy: "0.25em" }}
                  />
                </Group>
              </svg>
            );
          })()}
      </div>
      {tip.node}
    </div>
  );
}
