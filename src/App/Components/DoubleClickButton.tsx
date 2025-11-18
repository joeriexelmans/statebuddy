import { ButtonHTMLAttributes, useState } from "react";

import "./DoubleClickButton.css";
import { Tooltip } from "./Tooltip";

export function DoubleClickButton({children, onDoubleClick, align, tooltip, ...rest}: {align: "left" | "right", tooltip: string} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [clickedOnce, setClickedOnce] = useState(false);

  if (clickedOnce) {
    return <Tooltip tooltip="click again to confirm" align={align}>
      <button className="alert" {...rest} onClick={onDoubleClick} onMouseLeave={() => setClickedOnce(false)}>
        {children}
      </button>
    </Tooltip>;
  }
  else {
    return <Tooltip tooltip={tooltip} align={align}>
      <button {...rest} onClick={() => setClickedOnce(true)}>
        {children}
      </button>
    </Tooltip>;
  }
}
