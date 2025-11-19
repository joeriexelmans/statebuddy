import { HTMLAttributes, PropsWithChildren } from "react";

import "./Tooltip.css";

type TooltipProps = {
  tooltip: string | undefined,
  align: 'left' | 'right';
  fullWidth?: boolean,
  error?: boolean,
  above?: boolean,
  showWhen?: 'hover' | 'focus';
}

export function Tooltip({tooltip, children, align, fullWidth, error, above, showWhen}: PropsWithChildren<TooltipProps>) {
  return <span className={"tooltipOuter" + (fullWidth ? " fullWidth" : "")}>
    {children}
    {tooltip && <>
      <div className={"tooltipInner "
          + align
          + (error ? " error" : "")
          + (above ? " above" : "")
          + (showWhen === "focus" ? " whenFocus" : "")}>
        {tooltip}
        <div className={"tooltipArrow"}/>
      </div>
    </>}
  </span>;
}
