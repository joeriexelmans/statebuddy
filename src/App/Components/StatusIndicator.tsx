import traceStyles from "../SideBar/Trace.module.css";

export type StatusType = "ok" | "nok" | "pending";

// A 3-state status indicator
// The states are roughly:
//  - waiting
//  - ok
//  - fail
export function StatusIndicator({status}: {status: StatusType}) {
  return <div className={traceStyles.status + ' ' + traceStyles[status]}/>;
}

// A 6-state status indicator
// Like the 3-state indicator above, but with more 'emotion'...
// Besides displaying the three colors, the status indicator can also flash.
export function FlickeringStatusIndicator({big, status}: {big: boolean, status: StatusType}) {
  return <div style={big ? {
    width: 20,
    height: 20,
    backgroundColor: {
      "ok": 'var(--status-ok-color)',
      "nok": 'var(--status-nok-color)',
      "pending": 'var(--separator-color)',
    }[status],
    borderRadius: 10
    } : {}}>
    <StatusIndicator status={status}/>
  </div>;
}
