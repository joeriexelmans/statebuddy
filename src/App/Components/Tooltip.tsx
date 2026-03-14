import { HTMLAttributes, PropsWithChildren, ReactNode, useState } from "react";

import "./Tooltip.css";

export type TooltipProps = {
  tooltip?: string | ReactNode,
  align?: 'center' | 'left' | 'right';
  fullWidth?: boolean,
  error?: boolean,
  above?: boolean,
  showWhen?: 'hover' | 'focus' | 'always';
}

export function Tooltip({tooltip, children, align, fullWidth, error, above, showWhen, style}: PropsWithChildren<TooltipProps> & HTMLAttributes<Element>) {
  const [hidden, setHidden] = useState(false);
  return <span className={"tooltipOuter "
                            + (align !== undefined ? align : "")
                            + (fullWidth ? " fullWidth" : "")
                            + (error ? " error" : "")
                            + (above ? " above" : "")
                            + (showWhen === undefined ? " onhover" : " on"+showWhen)}
                style={style}
                onMouseEnter={() => setHidden(false)}
              >
    {children}
    {!hidden && tooltip && <div className="blurOnHover" onClick={() => setHidden(true)}>
      <div className={"tooltipArrow"}/>
      <div className={"tooltipInner"}>
        {tooltip}
      </div>
    </div>}
  </span>;
}
