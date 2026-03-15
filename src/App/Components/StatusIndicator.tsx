import { CSSProperties } from "react";
import traceStyles from "../SideBar/Trace.module.css";

export type StatusType = "ok" | "nok" | "pending";

// A 3-state status indicator
// The states are roughly:
//  - waiting
//  - ok
//  - fail
export function StatusIndicator({status, style}: {status: StatusType} & {style?: CSSProperties}) {
  return <div className={traceStyles.status + ' ' + traceStyles[status]} style={style}/>;
}

// A 6-state status indicator
// Like the 3-state indicator above, but with more 'emotion'...
// Besides displaying the three colors, the status indicator can also flash.
export function FlickeringStatusIndicator({big, status}: {big: boolean, status: StatusType}) {
  const color = {
    "ok": 'var(--status-ok-color)',
    "nok": 'var(--status-nok-color)',
    "pending": 'var(--separator-color)',
  }[status];
  return <StatusIndicator status={status} style={big ? {
    boxShadow: `0 0 4px 4px ${color}`,
    } : {}}/>;
}
