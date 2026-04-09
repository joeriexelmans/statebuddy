import styles from "./Trace.module.css";

import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PushPinIcon from '@mui/icons-material/PushPin';

import { EventTrigger } from "../../../statecharts/label_ast";
import { Tooltip } from "../../Components/Tooltip";
import { WithSetters } from "../../makePartialSetter";
import { TwoStateButton } from "@/App/Components/TwoStateButton";


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
        ? <Tooltip tooltip={<>unpin output event<br/>(don't keep output event if it doesn't occur in the Statechart model)</>} align='left'>
            <TwoStateButton onClick={undeclare} active><PushPinIcon fontSize='small'/></TwoStateButton>
          </Tooltip>
        : <Tooltip tooltip={<>pin output event<br/>(keep output event even if it doesn't occur in the Statechart model)</>} align='left'>
            <TwoStateButton onClick={declare} active={false}><PushPinIcon fontSize='small'/></TwoStateButton>
          </Tooltip>}
      <Tooltip tooltip='output event' align='left'>
        <div className={styles.outputEvent} >
          &#8599;
          {eventName}
        </div>
      </Tooltip>
    </div>;
  });
}
