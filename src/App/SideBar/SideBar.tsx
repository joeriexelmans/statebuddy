import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TableViewIcon from '@mui/icons-material/TableView';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { Statechart } from '@/statecharts/abstract_syntax';
import { objectsEqual } from '@/util/util';
import { memo, useCallback, useEffect, useState } from 'react';
import styles from "../App.module.css";
import { DoubleClickButton } from '../Components/DoubleClickButton';
import { MoveUpDown } from '../Components/MoveUpDown';
import { PersistentDetails } from '../Components/PersistentDetails';
import { Tooltip } from '../Components/Tooltip';
import { TwoStateButton } from '../Components/TwoStateButton';
import { defaultPlantsState, PlantsState } from "../hooks/useCoupledExecution";
import { CoupledState, SimulatorStuff } from '../hooks/useSimulator';
import { makeAllSetters, WithSetters } from '../makePartialSetter';
import { statebuddyPlants } from '../plants';
import { Connect } from './Connect';
import { PreparedTraces, PropertyCheckResult } from './prepare_trace';
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from './ShowAST';
import { ShowPlants } from './ShowPlants';
import "./SideBar.css";
import { Status } from './Status';
import { CoupledTrace } from './Trace';
import { defaultTracesState, Traces, TracesState } from './Traces';
import { initialize } from '@/statecharts/interpreter';

export type SideBarState = {
  showStateTree: boolean,
  showInputEvents: boolean,
  showInternalEvents: boolean,
  showOutputEvents: boolean,
  showPlant: boolean,
  showConnections: boolean,
  showProperties: boolean,
  showExecutionTrace: boolean,
  showTable: boolean,

  plantsState: PlantsState,
  properties: string[],
  activeProperty: number,

  traces: TracesState,
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
  showTable: false,

  plantsState: defaultPlantsState,
  properties: [],
  activeProperty: 0,

  traces: defaultTracesState,
};

type SideBarProps = WithSetters<{
  state: SideBarState;
}> & {
  simulator: SimulatorStuff,
  abstractSyntax?: Statechart,
  coupledState?: CoupledState,
  preparedTraces?: PreparedTraces,
  checkProperty: (property: string, preparedTraces: PreparedTraces) => Promise<PropertyCheckResult>,
};

export const SideBar = memo(function SideBar(props: SideBarProps) {
  const {abstractSyntax, preparedTraces, checkProperty, coupledState, state, setState, simulator} = props;

  const {trace, setTrace, time, setTime, simulatorCallbacks: {onRaise, onReplayTrace}} = simulator;

  const {showExecutionTrace, showConnections, showProperties, activeProperty, plantsState, properties, showPlant, showOutputEvents,  showInternalEvents, showInputEvents, showStateTree,showTable, traces} = state;

  const {setPlantsState, setActiveProperty, setShowProperties, setShowConnections, setShowExecutionTrace, setShowOutputEvents, setShowInternalEvents, setProperties, setShowInputEvents, setShowPlant, setShowStateTree, setShowTable, setTraces} = makeAllSetters(setState, Object.keys(state) as (keyof SideBarState)[]);

  const tracesSetters = makeAllSetters(setTraces, Object.keys(traces) as (keyof TracesState)[]);

  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | undefined>(undefined);

  const speed = time.kind === "paused" ? 0 : time.scale;

  // if some properties change, re-evaluate them:
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let clearResultTimeout: NodeJS.Timeout;
    if (preparedTraces) {
      // very often we recompute the same property on a trace that is one item longer, resulting in largely the same trace.
      clearResultTimeout = setTimeout(() => {
        setPropertyResults(undefined);
      }, 500);
      timeout = setTimeout(() => {
        Promise.all(properties.map((property, i) => {
          return checkProperty(property, preparedTraces);
        }))
        .then(results => {
          clearTimeout(clearResultTimeout);
          setPropertyResults(results);
        })
      })
    }
    return () => {
      clearTimeout(timeout);
      clearTimeout(clearResultTimeout);
    };
  }, [preparedTraces, properties]);

  const raiseDebugEvent = useCallback((e: string, p: any) => onRaise(e,p), [onRaise]);

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
            disabled={trace===undefined || trace.runtimeError!==undefined}
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

      {/* Properties */}
      <details open={showProperties} onToggle={e => setShowProperties(e.newState === "open")}>
        <summary>properties</summary>
        {properties.map((property, i) => {
          const result = propertyResults && propertyResults[i];
          let violated = null, propertyError = null;
          if (result) {
            violated = result[0] && result[0].length > 0 && !result[0][0][1];
            propertyError = result[1];
          }
          return <div style={{display: 'flex'}} key={i} className={styles.toolbar}>
            <div>
              <Status status={(violated === null) ? "pending" : (violated ? "violated" : "satisfied")} />
              <Tooltip tooltip="see in trace (below)" align="left">
                <TwoStateButton active={activeProperty === i} onClick={() => setActiveProperty(i)}>
                  <VisibilityIcon fontSize="small"/>
                </TwoStateButton>
              </Tooltip>
            </div>
            <Tooltip
              // tooltip={propertyError || plant && "available signals:\n"+plant.signals.map(s => "• "+s).join('\n')}
              tooltip=""
              align='left'
              fullWidth={true}
              error={Boolean(propertyError)}
              showWhen='focus'
              >
              <input
                className={propertyError && "error" || ""}
                type="text"
                style={{flexGrow: 1}}
                value={property}
                size={1}
                onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))} 
                placeholder='write MTL property...'
              />
            </Tooltip>
            <MoveUpDown i={i} ls={properties} setter={setProperties}/>
            <DoubleClickButton
              tooltip="delete this property"
              onDoubleClick={() => setProperties(properties => properties.toSpliced(i, 1))}
              align="right">
              <DeleteOutlineIcon fontSize="small"/>
            </DoubleClickButton>
          </div>;
        })}
        <div className={styles.toolbar}>
          <button onClick={() => setProperties(properties => [...properties, ""])} style={{flexGrow:1}}>
            <AddIcon fontSize="small"/> add property
          </button>
          <Tooltip tooltip="show table view">
            <TwoStateButton active={showTable} onClick={() => setShowTable(s => !s)} disabled={traces.savedTraces.length === 0 || properties.length === 0}>
              <TableViewIcon fontSize='small'/>
              Table
            </TwoStateButton>
          </Tooltip>
          <Tooltip tooltip='see MTL examples' align='right'>
            <button onClick={() => window.open("https://github.com/mvcisback/py-metric-temporal-logic/blob/ceb2567ef90f3bd5d7a8d607806a9d2e7021639e/README.md#string-based-api", "_blank")?.focus()}><HelpOutlineIcon fontSize='small'/> help</button>
          </Tooltip>
        </div>
      </details>

      {/* Traces */}
      <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}>
        <summary>execution traces</summary>
        <Traces {...traces} {...tracesSetters}
          time={time}
          trace={trace}
          onReplayTrace={onReplayTrace}
        />
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
              <CoupledTrace
                ast={abstractSyntax}
                setTime={setTime}
                currentTrace={trace}
                // @ts-ignore
                setCurrentTrace={setTrace}
                traces={traces}
                setTraces={setTraces}
                plantsState={plantsState}
                propertyTrace={propertyResults?.[activeProperty]?.[0] || []}
              />}
          </div>
      </div>}
  </>;
}, (prevProps, nextProps) => {
  return objectsEqual(prevProps, nextProps);
});
