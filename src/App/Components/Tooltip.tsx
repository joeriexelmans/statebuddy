import { HTMLAttributes, PropsWithChildren } from "react";

import "./Tooltip.css";

type TooltipProps = {
  tooltip: string | undefined,
  align: 'left' | 'right';
  fullWidth?: boolean,
  error?: boolean,
}

export function Tooltip({tooltip, children, align, fullWidth, error}: PropsWithChildren<TooltipProps>) {
  return <span className={"tooltipOuter" + (fullWidth ? " fullWidth" : "")}>
    {children}
    {tooltip && <>
      <div className={"tooltipArrow" + (error ? " error" : "")}/>
      <div className={"tooltipInner " + align + (error ? " error" : "")}>
        {tooltip}
      </div>
    </>}
  </span>;
}

export function TooltipAbove({tooltip, children, align, fullWidth, error}: PropsWithChildren<TooltipProps>) {
  return <span className={"tooltipOuter" + (fullWidth ? " fullWidth" : "")}>
    {tooltip && <>
      <div className={"tooltipInner above " + align + (error ? " error" : "")}>
        {tooltip}
      </div>
      <div className={"tooltipArrow above" + (error ? " error" : "")}/>
    </>}
    {children}
  </span>;
}
