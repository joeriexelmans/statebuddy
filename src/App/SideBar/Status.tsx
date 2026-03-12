import { Tooltip } from "../Components/Tooltip";

import traceStyles from "./Trace.module.css";

export type StatusType = "ok" | "nok" | "pending";

export function StatusIndicator({status}: {status: StatusType}) {
  return <div className={traceStyles.status + ' ' + traceStyles[status]}/>;
}

export function PropertyStatusIndicator({status}: {status: StatusType}) {
  const tooltip = {
    pending: "pending...",
    ok: "property satisfied",
    nok: "property violated",
  }[status];
  return <Tooltip tooltip={tooltip} align="left" above>
    <StatusIndicator status={status}/>
  </Tooltip>;
}
