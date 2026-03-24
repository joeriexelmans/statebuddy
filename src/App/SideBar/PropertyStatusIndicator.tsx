import { CSSProperties } from "react";
import { StatusIndicator, StatusType } from "../Components/StatusIndicator";
import { Tooltip } from "../Components/Tooltip";

const errStyle: CSSProperties = {
  width: 12,
  height: 12,
  marginLeft: 4,
  marginRight: 4,
  cursor: 'default',
  textAlign: 'center',
  fontSize: '10px',
};

export function PropertyStatusIndicator({status, errorMsg}: {status: StatusType | "err", errorMsg?: string}) {
  return <Tooltip tooltip={status === "err" ? errorMsg : {
      pending: "pending...",
      ok: "property satisfied",
      nok: "property violated",
    }[status]} align="left" above error={Boolean(errorMsg)}>
    {(status === "err")
        ? <div style={errStyle}>❌</div>
        : <StatusIndicator status={status}/>}
  </Tooltip>;
}
