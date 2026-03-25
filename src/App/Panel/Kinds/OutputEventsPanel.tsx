import styles from "./Trace.module.css";

import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

import { EventTrigger } from "../../../statecharts/label_ast";
import { Tooltip } from "../../Components/Tooltip";
import { WithSetters } from "../../makePartialSetter";


type ShowOutputEventsProps = {
  outputEvents: string[]
} & WithSetters<{
  declaredOutputs: EventTrigger[],
}>;


export function OutputEventsPanel({outputEvents, declaredOutputs, setDeclaredOutputs}: ShowOutputEventsProps) {
  return outputEvents.map((eventName) => {
    const isDeclared = declaredOutputs.some(o => o.event === eventName);
    const declare = () => setDeclaredOutputs(os => [...os, {kind: "event", event: eventName}]);
    const undeclare = () => setDeclaredOutputs(os => os.filter(event => event.event !== eventName))
    return <div key={eventName}>
      {isDeclared
        ? <Tooltip tooltip="remove declaration" align='left'><button onClick={undeclare}><RemoveIcon fontSize='small'/></button></Tooltip>
        : <Tooltip tooltip="add declaration" align='left'><button onClick={declare}><AddIcon fontSize='small'/></button></Tooltip>}
      <Tooltip tooltip='output event' align='left'>
        <div className={styles.outputEvent} >
          &#8599;
          {eventName}
        </div>
      </Tooltip>
    </div>;
  });
}
