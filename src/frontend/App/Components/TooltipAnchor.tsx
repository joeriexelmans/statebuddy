import { HTMLAttributes, PropsWithChildren, ReactNode, useId, useState } from "react";

import "./Tooltip.css";

export type TooltipProps = {
  tooltip?: string | ReactNode,
  align?: 'center' | 'left' | 'right';
  fullWidth?: boolean,
  error?: boolean,
  above?: boolean,
  showWhen?: 'hover' | 'focus' | 'always';
}

// WIP: an alternative Tooltip implementation that uses CSS anchor
export function TooltipAnchor({tooltip, children, align, fullWidth, error, above, showWhen, style}: PropsWithChildren<TooltipProps> & HTMLAttributes<Element>) {
  const [hidden, setHidden] = useState(false);
  const outerId = useId();
  const innerId = useId();
  console.log(outerId, innerId);
  return <>
    <style>{`
      #${outerId} { anchor-name: --${outerId}; }
      .outer:hover > .inner { visibility: unset !important; }
      ${showWhen === "focus" ? ".outer:focus > .inner { visibility: unset !important; }" : ""} 
      #${innerId} {
        ${((showWhen||"hover") !== "always") ? "visibility: hidden;" : ""}
        position-anchor: --${outerId};
        ${above ? "bottom: anchor(top);" : "top: anchor(bottom);"}
        ${{
          "left": "",
          "center": "left: anchor(50%); transform: translateX(-50%)",
          "right": "right: anchor(right);"
        }[align || "left"]}
      }
    `}</style>
    <span className="outer" onMouseEnter={() => setHidden(false)}>
      <span id={outerId}>{children}</span>
      {!hidden && <div id={innerId} className="inner" style={{position: 'fixed'}}>
        <div style={{
          backgroundColor: 'var(--tooltip-bg-color)',
          color: 'var(--tooltip-fg-color)',
          borderRadius: '3px',
          width: 'max-content',
          whiteSpace: 'preserve',
          maxWidth: '200px',
          paddingLeft: '4px',
          paddingRight: '4px',
          paddingTop: '2px',
          paddingBottom: '2px',
          cursor: 'normal',
          userSelect: 'none',
          fontWeight: 400,
        }}>{tooltip}</div>
      </div>}
    </span>
  </>
}
