import styles from "./Trace.module.css";
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import FlareIcon from '@mui/icons-material/Flare';
import { RaisedEvent } from "@/statecharts/runtime_types";
import { Tooltip } from "../Components/Tooltip";
import { actionLangValToText } from "@/statecharts/actionlang_prettyprinter";

export function InitCause() {
  return <div className={styles.inputEvent}>
    <Tooltip tooltip="initialized" align="left">
      <FlareIcon fontSize="small"/>
    </Tooltip>
  </div>;
}

export function TimerCause() {
  return <div className={styles.inputEvent}>
    <Tooltip tooltip="elapsed timer" align="left">
      <AccessAlarmIcon fontSize="small"/>
    </Tooltip>
  </div>;
}

export function InputCause({e}: {e: RaisedEvent}) {
  if (e.name.startsWith('_')) {
    return <div className={styles.internalEvent}>
      <Tooltip tooltip="handled internal event" align="left">
        {e.name}
        <EventParam param={e.param}/>
      </Tooltip>
    </div>;
  }
  else {
    return <div className={styles.inputEvent}>
      <Tooltip tooltip="handled input event" align="left">
        &#8600;
        {e.name}
        <EventParam param={e.param}/>
      </Tooltip>
    </div>;
  }
}

export function EventParam(props: {param?: any}) {
  return <>{props.param !== undefined && <>({actionLangValToText(props.param)})</>}</>;
}
