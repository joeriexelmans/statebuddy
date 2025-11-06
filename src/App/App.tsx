import "../index.css";
import "./App.css";

import { Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { Statechart } from "@/statecharts/abstract_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { Conns, coupledExecution, statechartExecution } from "@/statecharts/timed_reactive";
import { RuntimeError } from "../statecharts/interpreter";
import { parseStatechart } from "../statecharts/parser";
import { BigStep, RaisedEvent } from "../statecharts/runtime_types";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";
import { BottomPanel } from "./BottomPanel";
import { PersistentDetails } from "./PersistentDetails";
import { digitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";
import { dummyPlant } from "./Plant/Dummy/Dummy";
import { microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { InsertMode } from "./TopPanel/InsertModes";
import { TopPanel } from "./TopPanel/TopPanel";
import { VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { checkProperty, PropertyCheckResult } from "./check_property";
import { usePersistentState } from "./persistent_state";
import { useEditor } from "./useEditor";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

type UniversalPlantState = {[property: string]: boolean|number};

const plants: [string, Plant<any, UniversalPlantState>][] = [
  ["dummy", dummyPlant],
  ["microwave", microwavePlant as unknown as Plant<any, UniversalPlantState>],
  ["digital watch", digitalWatchPlant as unknown as Plant<any, UniversalPlantState>],
  ["traffic light", trafficLightPlant as unknown as Plant<any, UniversalPlantState>],
]

export type TraceItemError = {
  cause: string, // event name, <init> or <timer>
  simtime: number,
  error: RuntimeError,
}

type CoupledState = {
  sc: BigStep,
  plant: BigStep,
  // plantCleanState: {[prop: string]: boolean|number},
};

export type TraceItem =
  { kind: "error" } & TraceItemError
| { kind: "bigstep", simtime: number, cause: string, state: CoupledState, outputEvents: RaisedEvent[] };

export type TraceState = {
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
};

export function App() {
  const [insertMode, setInsertMode] = usePersistentState<InsertMode>("insertMode", "and");
  const [editHistory, setEditHistory] = useState<EditHistory|null>(null);
  const [trace, setTrace] = useState<TraceState|null>(null);
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [modal, setModal] = useState<ReactElement|null>(null);

  const [plantName, setPlantName] = usePersistentState("plant", "dummy");
  const [zoom, setZoom] = usePersistentState("zoom", 1);
  const [showKeys, setShowKeys] = usePersistentState("shortcuts", true);

  const [autoScroll, setAutoScroll] = usePersistentState("autoScroll", true);
  const [autoConnect, setAutoConnect] = usePersistentState("autoConnect", true);
  const [plantConns, setPlantConns] = usePersistentState<Conns>("plantConns", {});

  const plant = plants.find(([pn, p]) => pn === plantName)![1];

  const editorState = editHistory && editHistory.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => historyState && ({...historyState, current: cb(historyState.current)}));
  }, [setEditHistory]);

  const refRightSideBar = useRef<HTMLDivElement>(null);

  // parse concrete syntax always:
  const conns = useMemo(() => editorState && detectConnections(editorState), [editorState]);
  const parsed = useMemo(() => editorState && conns && parseStatechart(editorState, conns), [editorState, conns]);
  const ast = parsed && parsed[0];
  const syntaxErrors = parsed && parsed[1] || [];
  const currentTraceItem = trace && trace.trace[trace.idx];
  const allErrors = [
    ...syntaxErrors,
    ...(currentTraceItem && currentTraceItem.kind === "error") ? [{
      message: currentTraceItem.error.message,
      shapeUid: currentTraceItem.error.highlight[0],
    }] : [],
  ];

  const {makeCheckPoint, onRedo, onUndo, onRotate} = useEditor(editorState, setEditHistory);

  const scrollDownSidebar = useCallback(() => {
    if (autoScroll && refRightSideBar.current) {
      const el = refRightSideBar.current;
      // hack: we want to scroll to the new element, but we have to wait until it is rendered...
      setTimeout(() => {
        el.scrollIntoView({block: "end", behavior: "smooth"});
      }, 50);
    }
  }, [refRightSideBar.current, autoScroll]);

  // coupled execution
  const cE = useMemo(() => ast && coupledExecution({
    sc: statechartExecution(ast),
    plant: plant.execution,
  }, {
    ...plantConns,
    ...Object.fromEntries(ast.inputEvents.map(({event}) => ["debug."+event, ['sc',event] as [string,string]])),
  }), [ast]);

  const onInit = useCallback(() => {
    if (cE === null) return;
    const metadata = {simtime: 0, cause: "<init>"};
    try {
      const [outputEvents, state] = cE.initial(); // may throw if initialing the statechart results in a RuntimeError
      setTrace({
        trace: [{kind: "bigstep", ...metadata, state, outputEvents}],
        idx: 0,
      });
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        setTrace({
          trace: [{kind: "error", ...metadata, error}],
          idx: 0,
        });
      }
      else {
        throw error; // probably a bug in the interpreter
      }
    }
    setTime(time => {
      if (time.kind === "paused") {
        return {...time, simtime: 0};
      }
      else {
        return {...time, since: {simtime: 0, wallclktime: performance.now()}};
      }
    });
    scrollDownSidebar();
  }, [cE, scrollDownSidebar]);

  const onClear = useCallback(() => {
    setTrace(null);
    setTime({kind: "paused", simtime: 0});
  }, [setTrace, setTime]);

  // raise input event, producing a new runtime configuration (or a runtime error)
  const onRaise = (inputEvent: string, param: any) => {
    if (cE === null) return;
    if (currentTraceItem !== null /*&& ast.inputEvents.some(e => e.event === inputEvent)*/) {
      if (currentTraceItem.kind === "bigstep") {
        const simtime = getSimTime(time, Math.round(performance.now()));
        appendNewConfig(simtime, inputEvent, () => {
          return cE.extTransition(simtime, currentTraceItem.state, {kind: "input", name: inputEvent, param});
        });
      }
    }
  };

  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (currentTraceItem !== null && cE !== null) {
      if (currentTraceItem.kind === "bigstep") {
        const nextTimeout = cE?.timeAdvance(currentTraceItem.state);

        const raiseTimeEvent = () => {
          appendNewConfig(nextTimeout, "<timer>", () => {
            return cE.intTransition(currentTraceItem.state);
          });
        }

        if (time.kind === "realtime") {
          const wallclkDelay = getWallClkDelay(time, nextTimeout, Math.round(performance.now()));
          if (wallclkDelay !== Infinity) {
            timeout = setTimeout(raiseTimeEvent, wallclkDelay);
          }
        }
        else if (time.kind === "paused") {
          if (nextTimeout <= time.simtime) {
            raiseTimeEvent();
          }
        }
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [time, currentTraceItem]); // <-- todo: is this really efficient?

  function appendNewConfig(simtime: number, cause: string, computeNewState: () => [RaisedEvent[], CoupledState]) {
    let newItem: TraceItem;
    const metadata = {simtime, cause}
    try {
      const [outputEvents, state] = computeNewState(); // may throw RuntimeError
      newItem = {kind: "bigstep", ...metadata, state, outputEvents};
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        newItem = {kind: "error", ...metadata, error};
        // also pause the simulation, for dramatic effect:
        setTime({kind: "paused", simtime});
      }
      else {
        throw error;
      }
    }
    // @ts-ignore
    setTrace(trace => ({
      trace: [
        ...trace!.trace.slice(0, trace!.idx+1), // remove everything after current item
        newItem,
      ],
      // idx: 0,
      idx: trace!.idx+1,
    }));
    scrollDownSidebar();
  }

  const onBack = useCallback(() => {
    if (trace !== null) {
      setTime(() => {
        if (trace !== null) {
          return {
            kind: "paused",
            simtime: trace.trace[trace.idx-1].simtime,
          }
        }
        return { kind: "paused", simtime: 0 };
      });
      setTrace({
        ...trace,
        idx: trace.idx-1,
      });
    }
  }, [trace]);

  const currentBigStep = currentTraceItem && currentTraceItem.kind === "bigstep" && currentTraceItem;
  const highlightActive = (currentBigStep && currentBigStep.state.sc.mode) || new Set();
  const highlightTransitions = currentBigStep && currentBigStep.state.sc.firedTransitions || [];

  const [showExecutionTrace, setShowExecutionTrace] = usePersistentState("showExecutionTrace", true);
  const [showPlantTrace, setShowPlantTrace] = usePersistentState("showPlantTrace", false);

  const speed = time.kind === "paused" ? 0 : time.scale;

  const plantState = currentBigStep && currentBigStep.state.plant || plant.execution.initial()[1];

  useEffect(() => {
    ast && autoConnect && autoDetectConns(ast, plant, setPlantConns);
  }, [ast, plant, autoConnect]);

  const [properties, setProperties] = usePersistentState<string[]>("properties", []);
  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | null>(null);
  const [activeProperty, setActiveProperty] = usePersistentState<number>("activeProperty", 0);

  // if some properties change, re-evaluate them:
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (trace) {
      setPropertyResults(null);
      timeout = setTimeout(() => {
        Promise.all(properties.map((property, i) => {
          return checkProperty(plant, property, trace.trace);
        }))
        .then(results => {
          setPropertyResults(results);
        })
      })
    }
    return () => clearTimeout(timeout);
  }, [properties, trace, plant]);

  return <>

  {/* Modal dialog */}
  {modal && <div
    className="modalOuter"
    onMouseDown={() => setModal(null)}>
    <div className="modalInner">
      <span onMouseDown={e => e.stopPropagation()}>
      {modal}
      </span>
    </div>
  </div>}

  {/* top-to-bottom: everything -> bottom panel */}
  <div className="stackVertical" style={{height:'100%'}}>

    {/* left-to-right: main -> sidebar */}
    <div className="stackHorizontal" style={{flexGrow:1, overflow: "auto"}}>

      {/* top-to-bottom: top bar, editor */}
      <div className="stackVertical" style={{flexGrow:1, overflow: "auto"}}>
        {/* Top bar */}
        <div
          className="shadowBelow"
          style={{flex: '0 0 content'}}
        >
          {editHistory && <TopPanel
            {...{trace, time, setTime, onUndo, onRedo, onRotate, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory}}
          />}
        </div>
        {/* Editor */}
        <div style={{flexGrow: 1, overflow: "auto"}}>
          {editorState && conns && syntaxErrors &&
            <VisualEditor {...{state: editorState, setState: setEditorState, conns, trace, syntaxErrors: allErrors, insertMode, highlightActive, highlightTransitions, setModal, makeCheckPoint, zoom}}/>}
        </div>
      </div>

      {/* Right: sidebar */}
      <div style={{
        flex: '0 0 content',
        borderLeft: '1px solid lightgrey',
        overflowY: "auto",
        overflowX: "auto",
        maxWidth: 'min(400px, 50vw)',
      }}>
        <div className="stackVertical" style={{height:'100%'}}>
          <div
            className={showExecutionTrace ? "shadowBelow" : ""}
            style={{flex: '0 0 content', backgroundColor: ''}}
          >
            {/* State tree */}
            <PersistentDetails localStorageKey="showStateTree" initiallyOpen={true}>
              <summary>state tree</summary>
              <ul>
                {ast && <ShowAST {...{...ast, trace, highlightActive}}/>}
              </ul>
            </PersistentDetails>
            {/* Input events */}
            <PersistentDetails localStorageKey="showInputEvents" initiallyOpen={true}>
              <summary>input events</summary>
              {ast && <ShowInputEvents
                inputEvents={ast.inputEvents}
                onRaise={(e,p) => onRaise("debug."+e,p)}
                disabled={trace===null || trace.trace[trace.idx].kind === "error"}
                showKeys={showKeys}/>}
            </PersistentDetails>
            {/* Internal events */}
            <PersistentDetails localStorageKey="showInternalEvents" initiallyOpen={true}>
              <summary>internal events</summary>
              {ast && <ShowInternalEvents internalEvents={ast.internalEvents}/>}
            </PersistentDetails>
            {/* Output events */}
            <PersistentDetails localStorageKey="showOutputEvents" initiallyOpen={true}>
              <summary>output events</summary>
              {ast && <ShowOutputEvents outputEvents={ast.outputEvents}/>}
            </PersistentDetails>
            {/* Plant */}
            <PersistentDetails localStorageKey="showPlant" initiallyOpen={true}>
              <summary>plant</summary>
              <select
                disabled={trace!==null}
                value={plantName}
                onChange={e => setPlantName(() => e.target.value)}>
                {plants.map(([plantName, p]) =>
                  <option>{plantName}</option>
                )}
              </select>
              <br/>
              {/* Render plant */}
              {<plant.render state={plant.cleanupState(plantState)} speed={speed}
                raiseUIEvent={e => onRaise("plant.ui."+e.name, e.param)}
                />}
            </PersistentDetails>
            {/* Connections */}
            <PersistentDetails localStorageKey="showConnEditor" initiallyOpen={false}>
              <summary>connections</summary>
              <button title="auto-connect (name-based)" className={autoConnect?"active":""}
                onClick={() => setAutoConnect(c => !c)}>
                <AutoAwesomeIcon fontSize="small"/>
              </button>
              {ast && ConnEditor(ast, plant, plantConns, setPlantConns)}
            </PersistentDetails>
            {/* Properties */}
            <PersistentDetails localStorageKey="showProperty" initiallyOpen={false}>
              <summary>properties</summary>
              <div className="toolbar">
                <button title="add property" onClick={() => setProperties(properties => [...properties, ""])}>
                  <AddIcon fontSize="small"/>
                </button>
              </div>
              {properties.map((property, i) => {
                const result = propertyResults && propertyResults[i];
                let violated = null, propertyError = null;
                if (result) {
                  violated = result[0] && !result[0][0].satisfied;
                  propertyError = result[1];
                }
                return <div style={{width:'100%'}} key={i} className="toolbar">
                  <div className={"status" + (violated === null ? "" : (violated ? " violated" : " satisfied"))}></div>
                  &nbsp;
                  <button title="see in trace (below)" className={activeProperty === i ? "active" : ""} onClick={() => setActiveProperty(i)}>
                    <VisibilityIcon fontSize="small"/>
                  </button>
                  <input type="text" style={{width:'calc(97% - 70px)'}} value={property} onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))}/>
                  <button title="delete this property" onClick={() => setProperties(properties => properties.toSpliced(i, 1))}>
                    <DeleteOutlineIcon fontSize="small"/>
                  </button>
                  {propertyError && <div style={{color: 'var(--error-color)'}}>{propertyError}</div>}
                </div>;
              })}
            </PersistentDetails>
            {/* Traces */}

            <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary>
              <input id="checkbox-show-plant-items" type="checkbox" checked={showPlantTrace} onChange={e => setShowPlantTrace(e.target.checked)}/>
              <label htmlFor="checkbox-show-plant-items">show plant steps</label>
              <input id="checkbox-autoscroll" type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
              <label htmlFor="checkbox-autoscroll">auto-scroll</label>
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
          <div style={{flex: '0 0 content'}}>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom panel */}
    <div style={{flex: '0 0 content'}}>
      {syntaxErrors && <BottomPanel {...{errors: syntaxErrors}}/>}
    </div>
  </div>
  </>;
}

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
    {[...ast.outputEvents].map(e => <div style={{width:'100%', textAlign:'right'}}>
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
    {[...plant.outputEvents.map(e => <div style={{width:'100%', textAlign:'right'}}>
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

    {/* Plant UI events can go to SC or to Plant */}
    {plant.uiEvents.map(e => <div style={{width:'100%', textAlign:'right'}}>
      <label htmlFor={`select-dst-plant-ui-${e.event}`} style={{width:'50%'}}>ui.{e.event}&nbsp;→&nbsp;</label>
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

export default App;

