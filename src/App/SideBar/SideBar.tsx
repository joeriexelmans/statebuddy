import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { Statechart } from '@/statecharts/abstract_syntax';
import { objectsEqual } from '@/util/util';
import { memo, useCallback, useState } from 'react';
import styles from "../App.module.css";
import { PersistentDetails } from '../Components/PersistentDetails';
import { Tooltip } from '../Components/Tooltip';
import { defaultPlantsState, PlantsState } from "../hooks/useCoupledExecution";
import { CoupledState, SimulatorStuff } from '../hooks/useSimulator';
import { makeAllSetters, WithSetters } from '../makePartialSetter';
import { statebuddyPlants } from '../plants';
import { Connect } from './Connect';
import { CoupledDEVSTrace } from './CoupledDEVSTrace';
import { PreparedTraces, PropertyCheckResult } from './prepare_trace';
import { defaultPropertyEditorState, PropertyEditor, PropertyEditorState } from './PropertyEditor';
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from './ShowAST';
import { ShowPlants } from './ShowPlants';
import "./SideBar.css";
import { defaultTracesState, Traces, TracesState } from './Traces';
import { defaultMQTTState, MQTT, MQTTState } from './MQTT';

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
  coupledState?: CoupledState,
  propertyResults?: PropertyCheckResult[],
};

export const SideBar = memo(function SideBar(props: SideBarProps) {
  const {abstractSyntax, propertyResults, coupledState, state, setState, simulator} = props;

  const {trace, setTrace, time, setTime, simulatorCallbacks: {onRaise, onReplayTrace}} = simulator;

  const {showExecutionTrace, showConnections, showProperties, plantsState, propertyEditor, showPlant, showOutputEvents,  showInternalEvents, showInputEvents, showStateTree, traces, showMQTT} = state;

  const {setPlantsState, setShowProperties, setShowConnections, setShowExecutionTrace, setShowOutputEvents, setShowInternalEvents, setPropertyEditor, setShowInputEvents, setShowPlant, setShowStateTree, setTraces, setShowMQTT, setMqtt} = makeAllSetters(setState, Object.keys(state) as (keyof SideBarState)[]);

  const tracesSetters = makeAllSetters(setTraces, Object.keys(traces) as (keyof TracesState)[]);


  const speed = time.kind === "paused" ? 0 : time.scale;

  const raiseDebugEvent = useCallback((name: string, param: any) => onRaise([{name,param}]), [onRaise]);

  const onAddPlant = (type: string) => {
    const plantToInstantiate = statebuddyPlants[type];
    if (plantToInstantiate !== undefined) {
      setPlantsState(ps => ({
        plants: [
          ...ps.plants,
          {
            id: type + ps.nextPlantID.toString(), // <-- for readability, we include the plant type in the ID
            name: type + ps.nextPlantID.toString(),
            type,
          },
        ],
        conns: ps.conns,
        nextPlantID: ps.nextPlantID+1,
      }));
    }
  };

  return <>
    <div
      className={showExecutionTrace ? styles.shadowBelow : ""}
      style={{flex: '0 0 content', backgroundColor: ''}}
    >
      {/* State tree */}
      <PersistentDetails state={showStateTree} setState={setShowStateTree}>
        <summary>state tree</summary>
        <ul>
          {abstractSyntax && <ShowAST {...{...abstractSyntax, trace, highlightActive: new Set()}}/>}
        </ul>
      </PersistentDetails>

      {/* Input events */}
      <PersistentDetails state={showInputEvents} setState={setShowInputEvents}>
        <summary>input events</summary>
        {abstractSyntax && <div style={{columnWidth: 160}}>
          <ShowInputEvents
            inputEvents={abstractSyntax.inputEvents}
            onRaise={raiseDebugEvent}
            disabled={trace===undefined}
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
        <div className={styles.toolbar}>
          <Tooltip tooltip={trace!==undefined?"clear the current execution to add plant":""} align='left'>
            <select
              disabled={trace!==undefined}
              value="add plant..."
              onChange={e => onAddPlant(e.target.value)}>
              <option>add plant...</option>
              {Object.keys(statebuddyPlants).map((type) =>
                <option key={type}>{type}</option>
              )}
            </select>
          </Tooltip>
          &nbsp;
        </div>
        {/* Render plants */}
        {<ShowPlants
          plantsState={plantsState}
          setPlantsState={setPlantsState}
          speed={speed}
          coupledState={coupledState}
          onRaise={(e) => raiseDebugEvent(e.name, e.param)}
        />}
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
        <MQTT
          state={state.mqtt}
          setState={setMqtt}
          simulator={simulator}
        />
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
        {showExecutionTrace && <Traces {...traces} {...tracesSetters}
          time={time}
          trace={trace}
          onReplayTrace={onReplayTrace}
        />}
      </details>
    </div>

    {/* We cheat a bit, and render the execution trace depending on whether the <details> above is 'open' or not, rather than putting it as a child of the <details>. We do this because only then can we get the execution trace to scroll without the rest scrolling as well. */}
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
      </div>}
  </>;
}, (prevProps, nextProps) => {
  return objectsEqual(prevProps, nextProps);
});
