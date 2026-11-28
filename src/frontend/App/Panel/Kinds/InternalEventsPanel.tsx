import styles from "../../Trace/Trace.module.css";

import { Tooltip } from "../../Components/Tooltip";

export function InternalEventsPanel(props: {internalEvents: Set<string>}) {
  return [...props.internalEvents].map((event) => {
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
