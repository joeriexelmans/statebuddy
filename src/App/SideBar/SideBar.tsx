import AddIcon from '@mui/icons-material/Add';
import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TableViewIcon from '@mui/icons-material/TableView';

import { Dispatch, memo, Ref, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { Statechart } from '@/statecharts/abstract_syntax';
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from './ShowAST';
import { Plant } from '../Plant/Plant';
import { PreparedTraces, PropertyCheckResult } from './prepare_trace';
import { Setters, WithSetters } from '../makePartialSetter';
import { Trace } from './Trace';
import { statebuddyPlants } from '../plants';
import { getSimTime, TimeMode } from '@/statecharts/time';
import { PersistentDetails } from '../Components/PersistentDetails';
import "./SideBar.css";
import { objectsEqual } from '@/util/util';
import { RaisedEvent } from '@/statecharts/runtime_types';
import { DoubleClickButton } from '../Components/DoubleClickButton';
import { Tooltip } from '../Components/Tooltip';
import { MoveUpDown } from '../Components/MoveUpDown';

import styles from "../App.module.css";
import { Status } from './Status';
import { TwoStateButton } from '../Components/TwoStateButton';
import { ExtTransitionTrace, saveExtTransitions } from '@/devs/serialize_trace';
import { CoupledState, defaultPlantsState, PlantsState, StateBuddyTraceState } from '../hooks/useSimulator';
import { ShowPlants } from './ShowPlants';
import { Connect } from './Connect';

export type SavedTraces = [string, ExtTransitionTrace][];

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
  savedTraces: SavedTraces,
  showMicroSteps: boolean,
  showTransitions: boolean,
  autoScroll: boolean,
  showPlantTrace: boolean,
};

export const defaultSideBarState = {
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
  savedTraces: [],
  autoScroll: false,
  showMicroSteps: false,
  showTransitions: false,
  showPlantTrace: false,
};

type SideBarProps = SideBarState & WithSetters<{
  trace: StateBuddyTraceState|null,
  time: TimeMode,
}> & {
  refRightSideBar: Ref<HTMLDivElement>,
  ast: Statechart | null,
  coupledState: CoupledState|null,
  onRaise: (inputEvent: string, param: any) => void,
  onReplayTrace: (extTrace: ExtTransitionTrace) => void,
  preparedTraces: PreparedTraces | null,
  checkProperty: (property: string, preparedTraces: PreparedTraces) => Promise<PropertyCheckResult>,
} & Setters<SideBarState>;

export const SideBar = memo(function SideBar(props: SideBarProps) {

  const {showExecutionTrace, showConnections, showPlantTrace, showProperties, activeProperty, autoScroll, plantsState, setPlantsState, properties, savedTraces, refRightSideBar, ast, setSavedTraces, trace, setTrace, setProperties, setShowPlantTrace, setActiveProperty, setShowProperties, setAutoScroll, time, onReplayTrace, onRaise, setTime, setShowConnections, setShowExecutionTrace, showPlant, setShowPlant, showOutputEvents, setShowOutputEvents, setShowInternalEvents, showInternalEvents, setShowInputEvents, setShowStateTree, showInputEvents, showStateTree, preparedTraces, showTable, setShowTable, showMicroSteps, setShowMicroSteps, checkProperty, showTransitions, setShowTransitions, coupledState} = props;

  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | null>(null);

  const speed = time.kind === "paused" ? 0 : time.scale;

  const onSaveTrace = useCallback(() => {
    if (trace) {
      const extTrace = saveExtTransitions(trace.trace, getSimTime(time, performance.now()));
      setSavedTraces(savedTraces => [
        ...savedTraces, 
        ["", extTrace] as const,
      ])
    }
  }, [trace, setSavedTraces]);

  // if some properties change, re-evaluate them:
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (preparedTraces) {
      setPropertyResults(null);
      timeout = setTimeout(() => {
        Promise.all(properties.map((property, i) => {
          return checkProperty(property, preparedTraces);
        }))
        .then(results => {
          setPropertyResults(results);
        })
      })
    }
    return () => clearTimeout(timeout);
  }, [preparedTraces, properties]);

  // whenever the ast, the plant or 'autoconnect' option changes, detect connections:
  // useEffect(() => {
  //   if (ast && autoConnect) {
  //     autoDetectConns(ast, plant, setPlantConns);
  //   }
  // }, [ast, plant, autoConnect]);

  const raiseDebugEvent = useCallback((e: string, p: any) => onRaise(e,p), [onRaise]);
  // const raiseUIEvent = useCallback((e: RaisedEvent) => onRaise("plant.ui."+e.name, e.param), [onRaise]);

  // const [selectedPlant, setSelectedPlant] = useState<string>("add plant ...");

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
          {ast && <ShowAST {...{...ast, trace, highlightActive: new Set()}}/>}
        </ul>
      </PersistentDetails>

      {/* Input events */}
      <PersistentDetails state={showInputEvents} setState={setShowInputEvents}>
        <summary>input events</summary>
        {ast && <div style={{columnWidth: 160}}>
          <ShowInputEvents
            inputEvents={ast.inputEvents}
            onRaise={raiseDebugEvent}
            disabled={trace===null || trace.runtimeError!==undefined}
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
        {ast && <div style={{columnWidth: 160}}>
          <ShowInternalEvents internalEvents={ast.internalEvents}/>
        </div>}
      </PersistentDetails>

      {/* Output events */}
      <PersistentDetails state={showOutputEvents} setState={setShowOutputEvents}>
        <summary>output events</summary>
        {ast && <div style={{columnWidth: 160}}>
          <ShowOutputEvents outputEvents={[...ast.outputEvents].toSorted((a,b) => a.localeCompare(b)).map(e => ({name: e}))}/>
        </div>}
      </PersistentDetails>

      {/* Plant(s) */}
      <PersistentDetails state={showPlant} setState={setShowPlant}>
        <summary>plant(s)</summary>
        <div className={styles.toolbar}>
          <Tooltip tooltip={trace!==null?"clear the current execution to add plant":""} align='left'>
            <select
              disabled={trace!==null}
              value="add plant..."
              onChange={e => onAddPlant(e.target.value)}>
              <option>add plant...</option>
              {Object.keys(statebuddyPlants).map((type) =>
                <option key={type}>{type}</option>
              )}
            </select>
          </Tooltip>
          &nbsp;
          {/* <Tooltip tooltip='the behavior of each plant is also modeled by a statechart'>
            <button
              disabled={plantCS === null}
              onClick={() => {
                if (plantCS) {
                  deflateBuffer(str2buf(JSON.stringify({
                    editorState: {...plantCS, nextID: 9999, selection: []},
                    modelName: "[plant] "+plantName,
                  })))
                  .then(buf => {
                    window.open("#"+buf2base64(buf), '_blank');
                  })
                }
              }}
            >
              <OpenInNewIcon fontSize='small'/>
              &nbsp;plant statechart
            </button>
          </Tooltip> */}
        </div>
        {/* Render plants */}
        <ShowPlants
          plantsState={plantsState}
          setPlantsState={setPlantsState}
          speed={speed}
          coupledState={coupledState}
          onRaise={(e) => raiseDebugEvent(e.name, e.param)}
        />
      </PersistentDetails>

      {/* Connect */}
      <PersistentDetails state={showConnections} setState={setShowConnections}>
        <summary>connect</summary>
        {ast && <Connect ast={ast} plantsState={plantsState} setPlantsState={setPlantsState}/>}
        {/* <Tooltip tooltip="auto-connect (name-based)" align="left">
          <button
            className={autoConnect?"active":""}
            onClick={() => setAutoConnect(c => !c)}>
            <AutoAwesomeIcon fontSize="small"/>
          </button>
        </Tooltip> */}
        {/* {ast && ConnEditor(ast, plant, plantConns, setPlantConns)} */}
        {/* <Connections conns={plantConns} setConns={setPlantConns}/> */}
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
            <TwoStateButton active={showTable} onClick={() => setShowTable(s => !s)} disabled={savedTraces.length === 0 || properties.length === 0}>
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
        <div>
          {savedTraces.map((savedTrace, i) =>
            <div key={i} className={styles.toolbar} style={{alignItems: 'center'}}>
              <Tooltip tooltip="replay trace" align="left">
                <button
                  onClick={() => onReplayTrace(savedTrace[1])}>
                  <CachedOutlinedIcon fontSize="small"/>
                </button>
              </Tooltip>
              <Tooltip tooltip='duration' align='left'>
                <div style={{display:'inline-block', width: 22, fontSize: 9, textAlign: 'center'}}>{(Math.floor(savedTrace[1].lastSimTime/1000))}s</div>
              </Tooltip>
              <Tooltip tooltip='number of input events' align='left'>
                <div style={{display:'inline-block', width: 22, fontSize: 9, textAlign: 'center'}}>({savedTrace[1].trace.length})</div>
              </Tooltip>
              <Tooltip tooltip='does not have to be unique, can be empty...' align='left' fullWidth={true} showWhen='focus'>
                <input
                  placeholder="description"
                  type="text"
                  value={savedTrace[0]}
                  style={{flexGrow: 1}}
                  size={1}
                  className={styles.description}
                  onChange={e => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1, [e.target.value, savedTraces[i][1]]))}/>
              </Tooltip>
              <MoveUpDown i={i} ls={savedTraces} setter={setSavedTraces}/>
              <DoubleClickButton
                tooltip="forget this trace"
                onDoubleClick={() => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1))}
                align="right">
                  <DeleteOutlineIcon fontSize="small"/>
              </DoubleClickButton>
            </div>
          )}
        </div>
        <div className={styles.toolbar} style={{justifyContent: 'space-around', gap: '1em'}}>
          <Tooltip tooltip="plant steps are steps where only the state of a plant changed" align="left">
            <label>
              <input type="checkbox"
              checked={showPlantTrace}
              onChange={e => setShowPlantTrace(e.target.checked)}/>
              show plant steps
            </label>
          </Tooltip>
          <label>
            <input type="checkbox"
              checked={showMicroSteps}
              onChange={e => setShowMicroSteps(e.target.checked)}/>
              show microsteps
          </label>
          <label>
            <input type="checkbox"
              checked={showTransitions}
              onChange={e => setShowTransitions(e.target.checked)}/>
              show transitions
          </label>
          <Tooltip tooltip="scroll down upon new events" align="left">
            <input id="checkbox-autoscroll" type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
            <label htmlFor="checkbox-autoscroll">auto-scroll</label>
          </Tooltip>
          <button
            disabled={trace === null}
            onClick={() => onSaveTrace()}
            style={{marginLeft: 'auto', flexGrow: 1}}
            >
            <SaveOutlinedIcon fontSize="small"/> save trace
          </button>
        </div>
      </details>
    </div>

    {/* We cheat a bit, and render the execution trace depending on whether the <details> above is 'open' or not, rather than putting it as a child of the <details>. We do this because only then can we get the execution trace to scroll without the rest scrolling as well. */}
    {showExecutionTrace &&
      <div style={{
        flexGrow:1,
        overflow:'auto',
        minHeight: '50vh',
        // minHeight: '75%', // <-- allows us to always scroll down the sidebar far enough such that the execution history is enough in view
        }}>
          <div ref={refRightSideBar}>
            {ast && trace &&
              <Trace {...{trace, setTrace, setTime, ast, showMicroSteps, setShowMicroSteps, showTransitions, showPlantTrace, autoScroll,
                plantsState,
                propertyTrace: propertyResults && propertyResults[activeProperty] && propertyResults[activeProperty][0] || []}}
              />
            }
          </div>
      </div>}
  </>;
}, (prevProps, nextProps) => {
  return objectsEqual(prevProps, nextProps);
});

// function autoDetectConns(ast: Statechart, plant: Plant<any, any>, setPlantConns: Dispatch<SetStateAction<Conns>>) {
//   for (const {event: a} of plant.uiEvents) {
//     for (const {event: b} of plant.inputEvents) {
//       if (a === b) {
//         setPlantConns(conns => ({...conns, ['plant.ui.'+a]: ['plant', b]}));
//         break;
//       }
//     }
//     for (const {event: b} of ast.inputEvents) {
//       if (a === b) {
//         setPlantConns(conns => ({...conns, ['plant.ui.'+a]: ['sc', b]}));
//       }
//     }
//   }
//   for (const a of ast.outputEvents) {
//     for (const {event: b} of plant.inputEvents) {
//       if (a === b) {
//         setPlantConns(conns => ({...conns, ['sc.'+a]: ['plant', b]}));
//       }
//     }
//   }
//   for (const {event: a} of plant.outputEvents) {
//     for (const {event: b} of ast.inputEvents) {
//       if (a === b) {
//         setPlantConns(conns => ({...conns, ['plant.'+a]: ['sc', b]}));
//       }
//     }
//   }
// }

// function ConnEditor(ast: Statechart, plant: Plant<any, any>, plantConns: Conns, setPlantConns: Dispatch<SetStateAction<Conns>>) {
//   const plantInputs = <>{plant.inputEvents.map(e => <option key={'plant.'+e.event} value={'plant.'+e.event}>plant.{e.event}</option>)}</>
//   const scInputs = <>{ast.inputEvents.map(e => <option key={'sc.'+e.event} value={'sc.'+e.event}>sc.{e.event}</option>)}</>;
//   console.log({plantConns});
//   return <>
    
//     {/* SC output events can go to Plant */}
//     {[...ast.outputEvents].map(e => <div key={e} style={{width:'100%', textAlign:'right'}}>
//       <label htmlFor={`select-dst-sc-${e}`} style={{width:'50%'}}>sc.{e}&nbsp;→&nbsp;</label>
//       <select id={`select-dst-sc-${e}`}
//         style={{width:'50%'}}
//         value={plantConns['sc.'+e]?.join('.')}
//         // @ts-ignore
//         onChange={domEvent => setPlantConns(conns => ({...conns, [`sc.${e}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))}))}>
//         <option key="none" value=""></option>
//         {plantInputs}
//       </select>
//     </div>)}

//     {/* Plant output events can go to Statechart */}
//     {[...plant.outputEvents.map(e => <div key={e.event} style={{width:'100%', textAlign:'right'}}>
//       <label htmlFor={`select-dst-plant-${e.event}`} style={{width:'50%'}}>plant.{e.event}&nbsp;→&nbsp;</label>
//       <select id={`select-dst-plant-${e.event}`}
//         style={{width:'50%'}}
//         value={plantConns['plant.'+e.event]?.join('.')}
//         // @ts-ignore
//         onChange={(domEvent => setPlantConns(conns => ({...conns, [`plant.${e.event}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))})))}>
//         <option key="none" value=""></option>
//         {scInputs}
//       </select>
//     </div>)]}

//     {/* Plant UI events typically go to the Plant */}
//     {plant.uiEvents.map(e => <div key={e.event} style={{width:'100%', textAlign:'right'}}>
//       <label htmlFor={`select-dst-plant-ui-${e.event}`} style={{width:'50%', color: 'grey'}}>ui.{e.event}&nbsp;→&nbsp;</label>
//       <select id={`select-dst-plant-ui-${e.event}`}
//         style={{width:'50%'}}
//         value={plantConns['plant.ui.'+e.event]?.join('.')}
//         // @ts-ignore
//         onChange={domEvent => setPlantConns(conns => ({...conns, [`plant.ui.${e.event}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))}))}>
//         <option key="none" value=""></option>
//         {scInputs}
//         {plantInputs}
//       </select>
//     </div>)}
//   </>;
// }

