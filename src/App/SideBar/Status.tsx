import { Tooltip } from "../Components/Tooltip";

import traceStyles from "./Trace.module.css";

export function Status({status}: {status: "satisfied" | "violated" | "pending"}) {
  const tooltip = {
    pending: "pending...",
    satisfied: "property satisfied",
    violated: "property violated",
  }[status];
  return <Tooltip tooltip={tooltip} align="left" above>
    <div className={traceStyles.status + ' ' + traceStyles[status]}/>
  </Tooltip>;
}
