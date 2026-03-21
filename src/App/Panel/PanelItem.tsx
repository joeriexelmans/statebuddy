import { Statechart } from "@/statecharts/abstract_syntax";
import { WithSetters } from "../makePartialSetter"
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "../SideBar/ShowAST";
import { SimulatorStuff } from "../hooks/useSimulator";
import { ReactNode } from "react";
import { PlantsView } from "../SideBar/PlantsView";
import { PanelType, PlantsState } from "../migrations/v2_types";
import { Connect } from "../SideBar/Connect";
import { MQTT } from "../SideBar/MQTT";
import { MQTTState } from "../migrations/v2_types";
import { PropertyEditor } from "../SideBar/PropertyEditor";
import { PropertyEditorState } from "../migrations/v2_types";
import { PropertyCheckResult } from "../SideBar/prepare_trace";
import { Traces } from "../SideBar/Traces";
import { TracesState } from '../migrations/v2_types';
import { EventTrigger } from "@/statecharts/label_ast";

// Union of all the stuff any of the panels need to know about
export type GlobalProps = {
  abstractSyntax?: Statechart,
  simulator: SimulatorStuff,
  propertyResults?: PropertyCheckResult[],
} & WithSetters<{
  plantsState: PlantsState,
  mqtt: MQTTState,
  propertyEditor: PropertyEditorState,
  traces: TracesState,
  declaredInputs: EventTrigger[],
  declaredOutputs: EventTrigger[],
}>

export const panelTypes: PanelType[] = [
  "state tree",
  "input events",
  "internal events",
  "output events",
  "plants",
  "connect",
  "mqtt",
  "properties",
  "execution traces",
];

type PanelItemProps = {
  type: PanelType,
  globalProps: GlobalProps,
}

export function PanelItem({type, globalProps: {abstractSyntax, simulator, plantsState, setPlantsState, mqtt, setMqtt, propertyEditor, setPropertyEditor, propertyResults, traces, setTraces, declaredInputs, setDeclaredInputs, declaredOutputs, setDeclaredOutputs}}: PanelItemProps) {

  if (type === "state tree") {
    return <>{abstractSyntax && <ShowAST root={abstractSyntax.root}/>}</>
  }
  else if (type === "input events") {
    return <Columned>{abstractSyntax && <ShowInputEvents
      inputEvents={abstractSyntax.inputEvents}
      simulator={simulator}
      declaredInputs={declaredInputs}
      setDeclaredInputs={setDeclaredInputs}
    />}</Columned>
  }
  else if (type === "internal events") {
    return <Columned>{abstractSyntax && <ShowInternalEvents internalEvents={abstractSyntax.internalEvents}/>}</Columned>
  }
  else if (type === "output events") {
    return <Columned>{abstractSyntax &&
      <ShowOutputEvents
        outputEvents={[...abstractSyntax.outputEvents]}
        declaredOutputs={declaredOutputs}
        setDeclaredOutputs={setDeclaredOutputs}
      />
      }</Columned>
  }
  else if (type === "plants") {
    return <PlantsView
      plantsState={plantsState}
      setPlantsState={setPlantsState}
      simulator={simulator}
    />
  }
  else if (type === "connect") {
    return <>{abstractSyntax && <Connect
      abstractSyntax={abstractSyntax}
      plantsState={plantsState}
      setPlantsState={setPlantsState}
      />}</>
  }
  else if (type === "mqtt") {
    return <>{abstractSyntax && <MQTT
      state={mqtt}
      setState={setMqtt}
      simulator={simulator}
      abstractSyntax={abstractSyntax}
    />}</>
  }
  else if (type === "properties") {
    return <PropertyEditor
      state={propertyEditor}
      setState={setPropertyEditor}
      propertyResults={propertyResults}
      enableTable={traces.savedTraces.length === 0 || propertyEditor.properties.length === 0}
    />
  }
  else if (type === "execution traces") {
    // console.log({propertyResults, activeProp: propertyEditor.activeProperty});
    return <>{abstractSyntax &&
      <Traces
        state={traces}
        setState={setTraces}
        abstractSyntax={abstractSyntax}
        plantsState={plantsState}
        simulator={simulator}
        activePropertyTrace={propertyResults?.[propertyEditor.activeProperty]?.[0]}
      />}</>
  }
}

// Events are shown in columns
function Columned({children}: {children: ReactNode}) {
  return <div style={{columnWidth: 160}}>
    {children}
  </div>
}
