import { ButtonHTMLAttributes, useEffect, useRef, useState } from "react";

import "./DoubleClickButton.css";
import { Tooltip } from "./Tooltip";

export function DoubleClickButton({children, onDoubleClick, align, tooltip, fullWidth, above, ...rest}: {align?: "center" | "left" | "right", tooltip: string, fullWidth?: boolean, above?: boolean} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [clickedOnce, setClickedOnce] = useState(false);

  if (clickedOnce) {
    return <Tooltip tooltip="click again to confirm" align={align} showWhen="always" fullWidth={fullWidth} above={above}>
      <button
        {...rest}
        className="alert"
        onClick={e => {
          onDoubleClick?.(e);
          setClickedOnce(false); // <-- there's a reason for this but i'm too tired to explain
        }}
        onMouseLeave={() => setClickedOnce(false)}
        >
        {children}
      </button>
    </Tooltip>;
  }
  else {
    return <Tooltip tooltip={tooltip} align={align} fullWidth={fullWidth} above={above}>
      <button
        {...rest}
        onClick={() => setClickedOnce(true)}
      >
        {children}
      </button>
    </Tooltip>;
  }
}
