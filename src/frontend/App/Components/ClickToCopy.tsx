import { PropsWithChildren, useState } from "react";
import { Tooltip, TooltipProps } from "./Tooltip";

export function ClickToCopy({textToCopy, children, tooltip, showWhen, ...tooltipProps}: PropsWithChildren<{textToCopy: string} & TooltipProps>) {
  const [copied, setCopied] = useState(false);

  return <Tooltip
    {...tooltipProps}
    tooltip={copied ? "copied!" : tooltip}
    showWhen={copied && "always" || showWhen}
  >
    <div
      onClick={() => navigator.clipboard.writeText(textToCopy)
        .then(() => setCopied(true))}
      style={{cursor: "pointer"}}
      onMouseLeave={() => setCopied(false)}
    >
      {children}
    </div>
  </Tooltip>;
}
