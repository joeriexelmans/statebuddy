import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { Statechart } from '@/statecharts/abstract_syntax';
import { objectsEqual } from '@/util/util';
import { memo } from 'react';
import styles from "../App.module.css";
import { PersistentDetails } from '../Components/PersistentDetails';
import { Tooltip } from '../Components/Tooltip';
import { defaultPlantsState, PlantsState } from "../hooks/useCoupledExecution";
import { SimulatorStuff } from '../hooks/useSimulator';
import { makeAllSetters, WithSetters } from '../makePartialSetter';
import { Connect } from './Connect';
import { CoupledDEVSTrace } from './CoupledDEVSTrace';
import { defaultMQTTState, MQTT, MQTTState } from './MQTT';
import { PlantsView } from './PlantsView';
import { PropertyCheckResult } from './prepare_trace';
import { defaultPropertyEditorState, PropertyEditor, PropertyEditorState } from './PropertyEditor';
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from './ShowAST';
import "./SideBar.css";
import { defaultTracesState, Traces, TracesState } from './Traces';

export type SideBarState = {
  showStateTree: boolean,
  showInputEvents: boolean,
  showInternalEvents: boolean,
  showOutputEvents: boolean,
  showPlant: boolean,
  showConnections: boolean,
  showProperties: boolean,
  showExecutionTrace: boolean,
  showMQTT: boolean,

  plantsState: PlantsState,
  propertyEditor: PropertyEditorState,
  traces: TracesState,
  mqtt: MQTTState,
};

export const defaultSideBarState: SideBarState = {
  showStateTree: false,
  showInputEvents: true,
  showInternalEvents: true,
  showOutputEvents: true,
  showPlant: true,
  showConnections: false,
  showProperties: false,
  showExecutionTrace: true,
  showMQTT: false,

  plantsState: defaultPlantsState,
  propertyEditor: defaultPropertyEditorState,
  traces: defaultTracesState,
  mqtt: defaultMQTTState,
};

type SideBarProps = WithSetters<{
  state: SideBarState;
}> & {
  simulator: SimulatorStuff,
  abstractSyntax?: Statechart,
  propertyResults?: PropertyCheckResult[],
};

export const SideBar = memo(function SideBar(props: SideBarProps) {
  const {abstractSyntax, propertyResults, state, setState, simulator} = props;

  const {showExecutionTrace, showConnections, showProperties, plantsState, propertyEditor, showPlant, showOutputEvents,  showInternalEvents, showInputEvents, showStateTree, traces, showMQTT} = state;

  console.log(state, traces);

  const {setPlantsState, setShowProperties, setShowConnections, setShowExecutionTrace, setShowOutputEvents, setShowInternalEvents, setPropertyEditor, setShowInputEvents, setShowPlant, setShowStateTree, setTraces, setShowMQTT, setMqtt} = makeAllSetters(setState, Object.keys(state) as (keyof SideBarState)[]);

  return <>
    <div
      className={showExecutionTrace ? styles.shadowBelow : ""}
      style={{flex: '0 0 content', backgroundColor: ''}}
    >
      {/* State tree */}
      <PersistentDetails state={showStateTree} setState={setShowStateTree}>
        <summary>state tree</summary>
        <ul>
          {abstractSyntax && <ShowAST
            root={abstractSyntax.root}
          />}
        </ul>
      </PersistentDetails>

      {/* Input events */}
      <PersistentDetails state={showInputEvents} setState={setShowInputEvents}>
        <summary>input events</summary>
        {abstractSyntax && <div style={{columnWidth: 160}}>
          <ShowInputEvents
            inputEvents={abstractSyntax.inputEvents}
            simulator={simulator}
          />
        </div>}
      </PersistentDetails>

      {/* Internal events */}
      <PersistentDetails state={showInternalEvents} setState={setShowInternalEvents}>
        <summary>
          internal events
          <Tooltip tooltip="internal events always start with '_' (underscore)">
            <HelpOutlineIcon fontSize='small'/>
          </Tooltip>
        </summary>
        {abstractSyntax && <div style={{columnWidth: 160}}>
          <ShowInternalEvents internalEvents={abstractSyntax.internalEvents}/>
        </div>}
      </PersistentDetails>

      {/* Output events */}
      <PersistentDetails state={showOutputEvents} setState={setShowOutputEvents}>
        <summary>output events</summary>
        {abstractSyntax && <div style={{columnWidth: 160}}>
          <ShowOutputEvents outputEvents={[...abstractSyntax.outputEvents].toSorted((a,b) => a.localeCompare(b)).map(e => ({name: e}))}/>
        </div>}
      </PersistentDetails>

      {/* Plant(s) */}
      <PersistentDetails state={showPlant} setState={setShowPlant}>
        <summary>plant(s)</summary>
        <PlantsView
          plantsState={plantsState}
          setPlantsState={setPlantsState}
          simulator={simulator}
        />
      </PersistentDetails>

      {/* Connect */}
      <PersistentDetails state={showConnections} setState={setShowConnections}>
        <summary>connect</summary>
        {abstractSyntax && <Connect
          abstractSyntax={abstractSyntax}
          plantsState={plantsState}
          setPlantsState={setPlantsState}
          />}
      </PersistentDetails>

      {/* MQTT */}
      <PersistentDetails state={showMQTT} setState={setShowMQTT}>
        <summary>MQTT</summary>
        {abstractSyntax && <MQTT
          state={state.mqtt}
          setState={setMqtt}
          simulator={simulator}
          abstractSyntax={abstractSyntax}
        />}
      </PersistentDetails>

      {/* Properties */}
      <details open={showProperties} onToggle={e => setShowProperties(e.newState === "open")}>
        <summary>properties</summary>
        <PropertyEditor
          state={propertyEditor}
          setState={setPropertyEditor}
          propertyResults={propertyResults}
          enableTable={traces.savedTraces.length === 0 || propertyEditor.properties.length === 0}
        />
      </details>

      {/* Traces */}
      <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}>
        <summary>execution traces</summary>
        {abstractSyntax && showExecutionTrace &&
          <Traces
            abstractSyntax={abstractSyntax}
            plantsState={plantsState}
            state={traces}
            setState={setTraces}
            simulator={simulator}
            activePropertyTrace={propertyResults?.[propertyEditor.activeProperty]?.[0] || []}
          />}
      </details>
    </div>

    {/* We cheat a bit, and render the execution trace depending on whether the <details> above is 'open' or not, rather than putting it as a child of the <details>. We do this because only then can we get the execution trace to scroll without the rest scrolling as well.
    {showExecutionTrace &&
      <div style={{
        flexGrow:1,
        overflow:'auto',
        minHeight: '33vh',
        }}>
          <div>
            {abstractSyntax && trace &&
              <CoupledDEVSTrace
                ast={abstractSyntax}
                setTime={setTime}
                currentTrace={trace}
                // @ts-ignore
                setCurrentTrace={setTrace}
                traces={traces}
                setTraces={setTraces}
                plantsState={plantsState}
                propertyTrace={propertyResults?.[propertyEditor.activeProperty]?.[0] || []}
              />}
          </div>
      </div>} */}
  </>;
}, (prevProps, nextProps) => {
  return objectsEqual(prevProps, nextProps);
});
