import styles from "../../Trace/Trace.module.css";

import PushPinIcon from '@mui/icons-material/PushPin';

import { Tooltip } from "../../Components/Tooltip";
import { WithSetters } from "../../../util/partial_setter";
import { TwoStateButton } from "@/frontend/App/Components/TwoStateButton";
import { Toolbar } from "@/frontend/App/TopPanel/Toolbar";
import { EventTrigger } from "@/languages/statecharts/text/abstract_syntax";


type ShowOutputEventsProps = {
  outputEvents: string[]
} & WithSetters<{
  declaredOutputs: string[],
}>;


export function OutputEventsPanel({outputEvents, declaredOutputs, setDeclaredOutputs}: ShowOutputEventsProps) {
  return outputEvents.map((eventName) => {
    const isDeclared = declaredOutputs.some(o => o === eventName);
    const declare = () => setDeclaredOutputs(os => [...os, eventName]);
    const undeclare = () => setDeclaredOutputs(os => os.filter(event => event !== eventName))
    return <div key={eventName}>
      {isDeclared
        ? <Tooltip tooltip={<>unpin output event<br/>(don't keep output event if it doesn't occur in the Statechart model)</>} align='left'>
            <Toolbar>
            <TwoStateButton onClick={undeclare} active><PushPinIcon fontSize='small'/></TwoStateButton>
            </Toolbar>
          </Tooltip>
        : <Tooltip tooltip={<>pin output event<br/>(keep output event even if it doesn't occur in the Statechart model)</>} align='left'>
            <Toolbar>
            <TwoStateButton onClick={declare} active={false}><PushPinIcon fontSize='small'/></TwoStateButton>
            </Toolbar>
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
