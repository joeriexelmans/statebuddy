import { ButtonHTMLAttributes, useEffect, useRef, useState } from "react";

import "./DoubleClickButton.css";
import { Tooltip } from "./Tooltip";

export function DoubleClickButton({children, onDoubleClick, align, tooltip, fullWidth, ...rest}: {align?: "center" | "left" | "right", tooltip: string, fullWidth?: boolean} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [clickedOnce, setClickedOnce] = useState(false);

  if (clickedOnce) {
    return <Tooltip tooltip="click again to confirm" align={align} showWhen="always" fullWidth={fullWidth}>
      <button
        {...rest}
        className="alert"
        onClick={onDoubleClick}
        onMouseLeave={() => setClickedOnce(false)}
        >
        {children}
      </button>
    </Tooltip>;
  }
  else {
    return <Tooltip tooltip={tooltip} align={align} fullWidth={fullWidth}>
      <button
        {...rest}
        onClick={() => setClickedOnce(true)}
        >
        {children}
      </button>
    </Tooltip>;
  }
}
