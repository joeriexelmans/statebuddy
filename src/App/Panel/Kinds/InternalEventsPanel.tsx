import styles from "./Trace.module.css";

import { EventTrigger } from "../../../statecharts/label_ast";
import { Tooltip } from "../../Components/Tooltip";

export function InternalEventsPanel(props: {internalEvents: EventTrigger[]}) {
  return [...props.internalEvents].map(({event, param}) => {
    return <div key={event}>
      <Tooltip tooltip='internal event' align='left'>
        <div className={styles.internalEvent}>
          {event}
          {/* {param !== undefined && <>({param})</>} */}
        </div>
      </Tooltip>
    </div>;
  });
}
