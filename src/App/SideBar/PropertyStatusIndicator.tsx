import { StatusIndicator, StatusType } from "../Components/StatusIndicator";
import { Tooltip } from "../Components/Tooltip";

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
