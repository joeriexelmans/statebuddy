import { HTMLAttributes, PropsWithChildren } from "react";

import "./Tooltip.css";

type TooltipProps = {
  tooltip: string,
  align: 'left' | 'right';
}

export function Tooltip({tooltip, children, align}: PropsWithChildren<TooltipProps>) {
  return <span>
    <span className="tooltipOuter">
      {children}
      <br/>
      <div className="tooltipArrow"/>
      <div className={"tooltipInner " + align}>
        {tooltip}
      </div>
    </span>
  </span>;
}

export function TooltipAbove({tooltip, children, align}: PropsWithChildren<TooltipProps>) {
  return <span>
    <span className="tooltipOuter">
      <div className={"tooltipInner above " + align}>
        {tooltip}
      </div>
      <div className="tooltipArrow above"/>
      {/* <br/> */}
      {children}
    </span>
  </span>;
}