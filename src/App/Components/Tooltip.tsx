import { PropsWithChildren, useState } from "react";

import "./Tooltip.css";

type TooltipProps = {
  tooltip: string | undefined,
  align?: 'center' | 'left' | 'right';
  fullWidth?: boolean,
  error?: boolean,
  above?: boolean,
  showWhen?: 'hover' | 'focus' | 'always';
}

export function Tooltip({tooltip, children, align, fullWidth, error, above, showWhen}: PropsWithChildren<TooltipProps>) {
  const [hidden, setHidden] = useState(false);
  return <span className={"tooltipOuter "
                            + (align !== undefined ? align : "")
                            + (fullWidth ? " fullWidth" : "")
                            + (error ? " error" : "")
                            + (above ? " above" : "")
                            + (showWhen === undefined ? " onhover" : " on"+showWhen)}>
    {children}
    {!hidden && tooltip && <div className="blurOnHover" onClick={() => setHidden(true)}>
      <div className={"tooltipArrow"}/>
      <div className={"tooltipInner"}>
        {tooltip}
      </div>
    </div>}
  </span>;
}
