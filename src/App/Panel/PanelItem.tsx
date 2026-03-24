import { Statechart } from "@/statecharts/abstract_syntax";
import { ReactNode, useMemo } from "react";
import { AppState } from "../App.state";
import { SimulatorStuff } from "../hooks/useSimulator";
import { DeepSetter } from "../makePartialSetter";
import { PanelType } from "../migrations/v1_types";
import { autoConnect, Connect, useConnect } from "../SideBar/Connect";
import { MQTT } from "../SideBar/MQTT";
import { PlantsView } from "../SideBar/PlantsView";
import { PropertyCheckStatus } from "../SideBar/prepare_trace_types";
import { PropertyEditor } from "../SideBar/PropertyEditor";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "../SideBar/ShowAST";
import { Traces } from "../SideBar/Traces";

// Union of all the stuff any of the panels need to know about
export type GlobalProps = {
  appState: AppState,
  setAppState: DeepSetter<AppState>,
  abstractSyntax?: Statechart,
  simulator: SimulatorStuff,
  propertyResults?: PropertyCheckStatus[],
}

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
  isExpanded: boolean,
}

export function panelItemInfo({type, globalProps: {appState, abstractSyntax}}: PanelItemProps) {
  if (type === "connect" && abstractSyntax) {
    const [_, _2, suggestions] = useConnect(abstractSyntax, appState.execution.plants);
    if (suggestions.length > 0) {
      return `${suggestions.length} suggested connections`;
    }
  }
  return undefined;
}

export function PanelItem({type, globalProps: {appState, setAppState, abstractSyntax, simulator, propertyResults}, isExpanded}: PanelItemProps) {

  if (type === "state tree") {
    return <>{abstractSyntax && <ShowAST root={abstractSyntax.root}/>}</>
  }
  else if (type === "input events") {
    return useMemo(() =>
      <Columned>{abstractSyntax && <ShowInputEvents
        inputEvents={abstractSyntax.inputEvents}
        onRaise={simulator.simulatorCallbacks.onRaise}
        disabled={simulator.trace === undefined}
        declaredInputs={appState.syntax.declaredInputs}
        setDeclaredInputs={setAppState.setSyntax.setDeclaredInputs}
      />}</Columned>,
      [abstractSyntax?.inputEvents, simulator, appState.syntax.declaredInputs]);
  }
  else if (type === "internal events") {
    return <Columned>{abstractSyntax && <ShowInternalEvents internalEvents={abstractSyntax.internalEvents}/>}</Columned>
  }
  else if (type === "output events") {
    return useMemo(() =>
      <Columned>{abstractSyntax &&
        <ShowOutputEvents
          outputEvents={[...abstractSyntax.outputEvents]}
          declaredOutputs={appState.syntax.declaredOutputs}
          setDeclaredOutputs={setAppState.setSyntax.setDeclaredOutputs}
        />
      }</Columned>,
      [abstractSyntax?.outputEvents, appState.syntax.declaredOutputs]);
  }
  else if (type === "plants") {
    return <PlantsView
      plantsState={appState.execution.plants}
      setPlantsState={setAppState.setExecution.setPlants}
      simulator={simulator}
    />
  }
  else if (type === "connect") {
    return <>{abstractSyntax && <Connect
      abstractSyntax={abstractSyntax}
      plantsState={appState.execution.plants}
      setPlantsState={setAppState.setExecution.setPlants}
      />}</>
  }
  else if (type === "mqtt") {
    return <>{abstractSyntax && <MQTT
      state={appState.mqtt}
      setState={setAppState.setMqtt}
      simulator={simulator}
      abstractSyntax={abstractSyntax}
    />}</>
  }
  else if (type === "properties") {
    return <PropertyEditor
      properties={appState.execution.properties}
      setProperties={setAppState.setExecution.setProperties}
      activeProperty={appState.execution.activeProperty}
      setActiveProperty={setAppState.setExecution.setActiveProperty}
      showTable={appState.view.visibility.table}
      setShowTable={setAppState.setView.setVisibility.setTable}
      propertyResults={propertyResults}
    />
  }
  else if (type === "execution traces") {
    const propResults = propertyResults?.[appState.execution.activeProperty];
    const propTrace = propResults?.kind === "ok" && propResults.result || undefined;
    return <>{abstractSyntax &&
      <Traces
        state={appState}
        setState={setAppState}
        abstractSyntax={abstractSyntax}
        simulator={simulator}
        activePropertyTrace={propTrace}
        isExpanded={isExpanded}
      />}</>
  }
}

// Events are shown in columns
function Columned({children}: {children: ReactNode}) {
  return <div style={{columnWidth: 160}}>
    {children}
  </div>
}
