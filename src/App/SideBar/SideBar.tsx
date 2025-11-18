import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Conns } from '@/statecharts/timed_reactive';
import { Dispatch, memo, Ref, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { Statechart } from '@/statecharts/abstract_syntax';
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from './ShowAST';
import { Plant } from '../Plant/Plant';
import { checkProperty, PreparedTraces, PropertyCheckResult } from './check_property';
import { Setters } from '../makePartialSetter';
import { RTHistory } from './RTHistory';
import { BigStepCause, TraceState } from '../hooks/useSimulator';
import { plants, UniversalPlantState } from '../plants';
import { TimeMode } from '@/statecharts/time';
import { PersistentDetails } from '../Components/PersistentDetails';
import "./SideBar.css";
import { objectsEqual } from '@/util/util';
import { RaisedEvent } from '@/statecharts/runtime_types';
import { DoubleClickButton } from '../Components/DoubleClickButton';
import { Tooltip } from '../Components/Tooltip';

type SavedTraces = [string, BigStepCause[]][];

export type SideBarState = {
  showStateTree: boolean,
  showInputEvents: boolean,
  showInternalEvents: boolean,
  showOutputEvents: boolean,
  showPlant: boolean,
  showConnections: boolean,
  showProperties: boolean,
  showExecutionTrace: boolean,

  plantName: string,
  plantConns: Conns,
  autoConnect: boolean,

  properties: string[],
  activeProperty: number,
  savedTraces: SavedTraces,
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

  plantName: 'dummy',
  plantConns: {},
  autoConnect: true,

  properties: [],
  activeProperty: 0,
  savedTraces: [],
  autoScroll: false,
  showPlantTrace: false,
};

type SideBarProps = SideBarState & {
  refRightSideBar: Ref<HTMLDivElement>,
  ast: Statechart | null,
  plant: Plant<any, UniversalPlantState>,
  // setSavedTraces: Dispatch<SetStateAction<SavedTraces>>,
  trace: TraceState|null,
  setTrace: Dispatch<SetStateAction<TraceState|null>>,
  plantState: UniversalPlantState,
  onRaise: (inputEvent: string, param: any) => void,
  onReplayTrace: (causes: BigStepCause[]) => void,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  time: TimeMode,
  preparedTraces: PreparedTraces | null,
} & Setters<SideBarState>;

export const SideBar = memo(function SideBar({showExecutionTrace, showConnections, plantName, showPlantTrace, showProperties, activeProperty, autoConnect, autoScroll, plantConns, properties, savedTraces, refRightSideBar, ast, plant, setSavedTraces, trace, setTrace, setProperties, setShowPlantTrace, setActiveProperty, setPlantConns, setPlantName, setAutoConnect, setShowProperties, setAutoScroll, time, plantState, onReplayTrace, onRaise, setTime, setShowConnections, setShowExecutionTrace, showPlant, setShowPlant, showOutputEvents, setShowOutputEvents, setShowInternalEvents, showInternalEvents, setShowInputEvents, setShowStateTree, showInputEvents, showStateTree, preparedTraces}: SideBarProps) {

  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | null>(null);

  const speed = time.kind === "paused" ? 0 : time.scale;

  const onSaveTrace = useCallback(() => {
    if (trace) {
      setSavedTraces(savedTraces => [
        ...savedTraces,
        ["untitled", trace.trace.map((item) => item.cause)] as [string, BigStepCause[]],
      ]);
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
  useEffect(() => {
    if (ast && autoConnect) {
      autoDetectConns(ast, plant, setPlantConns);
    }
  }, [ast, plant, autoConnect]);

  const raiseDebugEvent = useCallback((e: string, p: any) => onRaise("debug."+e,p), [onRaise]);
  const raiseUIEvent = useCallback((e: RaisedEvent) => onRaise("plant.ui."+e.name, e.param), [onRaise]);

  return <>
    <div
      className={showExecutionTrace ? "shadowBelow" : ""}
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
        {ast && <ShowInputEvents
          inputEvents={ast.inputEvents}
          onRaise={raiseDebugEvent}
          disabled={trace===null || trace.trace[trace.idx].kind === "error"}
        />}
      </PersistentDetails>

      {/* Internal events */}
      <PersistentDetails state={showInternalEvents} setState={setShowInternalEvents}>
        <summary>internal events</summary>
        {ast && <ShowInternalEvents internalEvents={ast.internalEvents}/>}
      </PersistentDetails>

      {/* Output events */}
      <PersistentDetails state={showOutputEvents} setState={setShowOutputEvents}>
        <summary>output events</summary>
        {ast && <ShowOutputEvents outputEvents={ast.outputEvents}/>}
      </PersistentDetails>

      {/* Plant */}
      <PersistentDetails state={showPlant} setState={setShowPlant}>
        <summary>plant</summary>
        <select
          disabled={trace!==null}
          value={plantName}
          onChange={e => setPlantName(() => e.target.value)}>
          {plants.map(([plantName]) =>
            <option key={plantName}>{plantName}</option>
          )}
        </select>
        <br/>
        {/* Render plant */}
        {<plant.render state={plant.cleanupState(plantState)} speed={speed}
          raiseUIEvent={raiseUIEvent}
          />}
      </PersistentDetails>

      {/* Connections */}
      <PersistentDetails state={showConnections} setState={setShowConnections}>
        <summary>connections</summary>
        <Tooltip tooltip="auto-connect (name-based)" align="left">
          <button
            className={autoConnect?"active":""}
            onClick={() => setAutoConnect(c => !c)}>
            <AutoAwesomeIcon fontSize="small"/>
          </button>
        </Tooltip>
        {ast && ConnEditor(ast, plant, plantConns, setPlantConns)}
      </PersistentDetails>

      {/* Properties */}
      <details open={showProperties} onToggle={e => setShowProperties(e.newState === "open")}>
        <summary>properties</summary>
        {plant && <div>
          available signals:
          &nbsp;
          {plant.signals.join(', ')}
        </div>}
        {properties.map((property, i) => {
          const result = propertyResults && propertyResults[i];
          let violated = null, propertyError = null;
          if (result) {
            violated = result[0] && result[0].length > 0 && !result[0][0][1];
            propertyError = result[1];
          }
          const status = (violated === null) ? "pending" : (violated ? "property violated" : "property satisfied");
          return <div style={{display: 'flex'}} key={i} className="toolbar">
            <div>
              <Tooltip tooltip={status} align="left">
                <div className={"status" + (violated === null ? "" : (violated ? " violated" : " satisfied"))}/>
              </Tooltip>
              <Tooltip tooltip="see in trace (below)" align="left">
                <button
                  className={activeProperty === i ? "active" : ""}
                  onClick={() => setActiveProperty(i)}>
                  <VisibilityIcon fontSize="small"/>
                </button>
              </Tooltip>
            </div>
            <Tooltip tooltip={propertyError || ""} align='left' fullWidth={true} error={true}>
              <input
                className={propertyError && "error" || ""}
                type="text"
                style={{flexGrow: 1}}
                value={property}
                onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))} 
                placeholder='write MTL property...'
              />
            </Tooltip>
            <DoubleClickButton
              tooltip="delete this property"
              onDoubleClick={() => setProperties(properties => properties.toSpliced(i, 1))}
              align="right">
              <DeleteOutlineIcon fontSize="small"/>
            </DoubleClickButton>
            {/* {propertyError && <div style={{color: 'var(--error-color)'}}>{propertyError}</div>} */}
          </div>;
        })}
        <div className="toolbar">
          <button onClick={() => setProperties(properties => [...properties, ""])}>
            <AddIcon fontSize="small"/> add property
          </button>

          <Tooltip tooltip='see MTL examples' align='left'>
            <button onClick={() => window.open("https://github.com/mvcisback/py-metric-temporal-logic/blob/ceb2567ef90f3bd5d7a8d607806a9d2e7021639e/README.md#string-based-api", "_blank")?.focus()}><HelpOutlineIcon fontSize='small'/> help</button>
          </Tooltip>
        </div>
      </details>
      {/* Traces */}
      <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary>
        <div>
          {savedTraces.map((savedTrace, i) =>
            <div key={i} className="toolbar">
              <Tooltip tooltip="replay trace" align="left">
              <button
                onClick={() => onReplayTrace(savedTrace[1])}>
                <CachedOutlinedIcon fontSize="small"/>
              </button>
              </Tooltip>
              &nbsp;
              <span style={{display:'inline-block', width: 26, fontSize: 9}}>{(Math.floor(savedTrace[1].at(-1)!.simtime/1000))}s</span>
              <span style={{display:'inline-block', width: 22, fontSize: 9}}>({savedTrace[1].length})</span>
              &nbsp;
              <input
                placeholder="name of recorded trace"
                type="text"
                value={savedTrace[0]}
                style={{width: 'calc(100% - 124px)'}}
                onChange={e => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1, [e.target.value, savedTraces[i][1]]))}/>
              <DoubleClickButton
                tooltip="forget this trace"
                onDoubleClick={() => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1))}
                align="right">
                  <DeleteOutlineIcon fontSize="small"/>
              </DoubleClickButton>
            </div>
          )}
        </div>
        <div className="toolbar">
          <Tooltip tooltip="plant steps are steps where only the state of the plant changed" align="left">
          <input id="checkbox-show-plant-items" type="checkbox"
            checked={showPlantTrace}
            onChange={e => setShowPlantTrace(e.target.checked)}/>
          <label htmlFor="checkbox-show-plant-items">show plant steps</label>
          </Tooltip>
          <Tooltip tooltip="scroll down upon new events" align="left">
          <input id="checkbox-autoscroll" type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
          <label htmlFor="checkbox-autoscroll">auto-scroll</label>
          </Tooltip>
          &emsp;
          <button
            disabled={trace === null}
            onClick={() => onSaveTrace()}>
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
            {ast && <RTHistory {...{ast, trace, setTrace, setTime, showPlantTrace,
              propertyTrace: propertyResults && propertyResults[activeProperty] && propertyResults[activeProperty][0] || []}}/>}
          </div>
      </div>}
  </>;
}, (prevProps, nextProps) => {
  return objectsEqual(prevProps, nextProps);
});

function autoDetectConns(ast: Statechart, plant: Plant<any, any>, setPlantConns: Dispatch<SetStateAction<Conns>>) {
  for (const {event: a} of plant.uiEvents) {
    for (const {event: b} of plant.inputEvents) {
      if (a === b) {
        setPlantConns(conns => ({...conns, ['plant.ui.'+a]: ['plant', b]}));
        break;
      }
    }
    for (const {event: b} of ast.inputEvents) {
      if (a === b) {
        setPlantConns(conns => ({...conns, ['plant.ui.'+a]: ['sc', b]}));
      }
    }
  }
  for (const a of ast.outputEvents) {
    for (const {event: b} of plant.inputEvents) {
      if (a === b) {
        setPlantConns(conns => ({...conns, ['sc.'+a]: ['plant', b]}));
      }
    }
  }
  for (const {event: a} of plant.outputEvents) {
    for (const {event: b} of ast.inputEvents) {
      if (a === b) {
        setPlantConns(conns => ({...conns, ['plant.'+a]: ['sc', b]}));
      }
    }
  }
}

function ConnEditor(ast: Statechart, plant: Plant<any, any>, plantConns: Conns, setPlantConns: Dispatch<SetStateAction<Conns>>) {
  const plantInputs = <>{plant.inputEvents.map(e => <option key={'plant.'+e.event} value={'plant.'+e.event}>plant.{e.event}</option>)}</>
  const scInputs = <>{ast.inputEvents.map(e => <option key={'sc.'+e.event} value={'sc.'+e.event}>sc.{e.event}</option>)}</>;
  return <>
    
    {/* SC output events can go to Plant */}
    {[...ast.outputEvents].map(e => <div key={e} style={{width:'100%', textAlign:'right'}}>
      <label htmlFor={`select-dst-sc-${e}`} style={{width:'50%'}}>sc.{e}&nbsp;→&nbsp;</label>
      <select id={`select-dst-sc-${e}`}
        style={{width:'50%'}}
        value={plantConns['sc.'+e]?.join('.')}
        // @ts-ignore
        onChange={domEvent => setPlantConns(conns => ({...conns, [`sc.${e}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))}))}>
        <option key="none" value=""></option>
        {plantInputs}
      </select>
    </div>)}

    {/* Plant output events can go to Statechart */}
    {[...plant.outputEvents.map(e => <div key={e.event} style={{width:'100%', textAlign:'right'}}>
      <label htmlFor={`select-dst-plant-${e.event}`} style={{width:'50%'}}>plant.{e.event}&nbsp;→&nbsp;</label>
      <select id={`select-dst-plant-${e.event}`}
        style={{width:'50%'}}
        value={plantConns['plant.'+e.event]?.join('.')}
        // @ts-ignore
        onChange={(domEvent => setPlantConns(conns => ({...conns, [`plant.${e.event}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))})))}>
        <option key="none" value=""></option>
        {scInputs}
      </select>
    </div>)]}

    {/* Plant UI events typically go to the Plant */}
    {plant.uiEvents.map(e => <div key={e.event} style={{width:'100%', textAlign:'right'}}>
      <label htmlFor={`select-dst-plant-ui-${e.event}`} style={{width:'50%', color: 'grey'}}>ui.{e.event}&nbsp;→&nbsp;</label>
      <select id={`select-dst-plant-ui-${e.event}`}
        style={{width:'50%'}}
        value={plantConns['plant.ui.'+e.event]?.join('.')}
        // @ts-ignore
        onChange={domEvent => setPlantConns(conns => ({...conns, [`plant.ui.${e.event}`]: (domEvent.target.value === "" ? undefined : (domEvent.target.value.split('.') as [string,string]))}))}>
        <option key="none" value=""></option>
        {scInputs}
        {plantInputs}
      </select>
    </div>)}
  </>;
}

