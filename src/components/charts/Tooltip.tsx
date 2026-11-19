import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import type { ReactNode } from "react";

/** Shared hover tooltip for the charts, rendered in a portal so it never clips at a panel edge. */
export function useChartTooltip() {
  const tt = useTooltip<ReactNode>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({ scroll: true, detectBounds: true });
  const show = (e: React.MouseEvent, content: ReactNode) => {
    const box = (e.currentTarget as Element).closest("[data-chart]")?.getBoundingClientRect();
    tt.showTooltip({
      tooltipData: content,
      tooltipLeft: e.clientX - (box?.left ?? 0),
      tooltipTop: e.clientY - (box?.top ?? 0),
    });
  };
  const node = tt.tooltipOpen ? (
    <TooltipInPortal left={tt.tooltipLeft} top={tt.tooltipTop} unstyled applyPositionStyle className="tip">
      {tt.tooltipData}
    </TooltipInPortal>
  ) : null;
  return { containerRef, show, hide: tt.hideTooltip, node };
}
