import { ButtonHTMLAttributes, useEffect, useRef, useState } from "react";

import "./DoubleClickButton.css";
import { Tooltip } from "./Tooltip";

export function DoubleClickButton({children, onDoubleClick, align, tooltip, ...rest}: {align?: "center" | "left" | "right", tooltip: string} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [clickedOnce, setClickedOnce] = useState(false);

  if (clickedOnce) {
    return <Tooltip tooltip="click again to confirm" align={align} showWhen="always">
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
    return <Tooltip tooltip={tooltip} align={align} showWhen="hover">
      <button
        {...rest}
        onClick={() => setClickedOnce(true)}
        >
        {children}
      </button>
    </Tooltip>;
  }
}
