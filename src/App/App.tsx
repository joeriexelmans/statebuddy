import "../index.css";
import "./App.css";

import { Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { Statechart } from "@/statecharts/abstract_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { Conns, coupledExecution, statechartExecution } from "@/statecharts/timed_reactive";
import { RuntimeError } from "../statecharts/interpreter";
import { parseStatechart } from "../statecharts/parser";
import { BigStep, RaisedEvent } from "../statecharts/runtime_types";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";
import { BottomPanel } from "./BottomPanel";
import { PersistentDetails, PersistentDetailsLocalStorage } from "./PersistentDetails";
import { digitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";
import { dummyPlant } from "./Plant/Dummy/Dummy";
import { microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { TopPanel } from "./TopPanel/TopPanel";
import { VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { checkProperty, PropertyCheckResult } from "./check_property";
import { useEditor } from "./useEditor";
import { useUrlHashState } from "./useUrlHashState";

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
  cause: BigStepCause, // event name, <init> or <timer>
  simtime: number,
  error: RuntimeError,
}

type CoupledState = {
  sc: BigStep,
  plant: BigStep,
  // plantCleanState: {[prop: string]: boolean|number},
};

export type BigStepCause = {
  kind: "init",
  simtime: 0,
} | {
  kind: "input",
  simtime: number,
  eventName: string,
  param?: any,
} | {
  kind: "timer",
  simtime: number,
};

export type TraceItem =
  { kind: "error" } & TraceItemError
| { kind: "bigstep", simtime: number, cause: BigStepCause, state: CoupledState, outputEvents: RaisedEvent[] };

export type TraceState = {
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
};

export function App() {
  const [editHistory, setEditHistory] = useState<EditHistory|null>(null);
  const [trace, setTrace] = useState<TraceState|null>(null);
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [modal, setModal] = useState<ReactElement|null>(null);

  const {makeCheckPoint, onRedo, onUndo, onRotate} = useEditor(setEditHistory);

  const editorState = editHistory && editHistory.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => historyState && ({...historyState, current: cb(historyState.current)}));
  }, [setEditHistory]);

  const {
    autoConnect,
    setAutoConnect,
    autoScroll,
    setAutoScroll,
    plantConns,
    setPlantConns,
    showKeys,
    setShowKeys,
    zoom,
    setZoom,
    insertMode,
    setInsertMode,
    plantName,
    setPlantName,
    showConnections,
    setShowConnections,
    showProperties,
    setShowProperties,
    showExecutionTrace,
    setShowExecutionTrace,
    showPlantTrace,
    setShowPlantTrace,
    properties,
    setProperties,
    savedTraces,
    setSavedTraces,
    activeProperty,
    setActiveProperty,
  } = useUrlHashState(editorState, setEditHistory);
  const plant = plants.find(([pn, p]) => pn === plantName)![1];

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
    const metadata = {simtime: 0, cause: {kind: "init" as const, simtime: 0 as const}};
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
        appendNewConfig(simtime, {kind: "input", simtime, eventName: inputEvent, param}, () => {
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
          appendNewConfig(nextTimeout, {kind: "timer", simtime: nextTimeout}, () => {
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

  function appendNewConfig(simtime: number, cause: BigStepCause, computeNewState: () => [RaisedEvent[], CoupledState]) {
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


  const speed = time.kind === "paused" ? 0 : time.scale;

  const plantState = currentBigStep && currentBigStep.state.plant || plant.execution.initial()[1];

  useEffect(() => {
    ast && autoConnect && autoDetectConns(ast, plant, setPlantConns);
  }, [ast, plant, autoConnect]);

  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | null>(null);


  const onSaveTrace = () => {
    if (trace) {
      setSavedTraces(savedTraces => [
        ...savedTraces,
        ["untitled", trace.trace.map((item) => item.cause)] as [string, BigStepCause[]],
      ]);
    }
  }

  const onReplayTrace = (causes: BigStepCause[]) => {
    if (cE) {
      function run_until(simtime: number) {
        while (true) {
          const nextTimeout = cE!.timeAdvance(lastState);
          if (nextTimeout > simtime) {
            break;
          }
          const [outputEvents, coupledState] = cE!.intTransition(lastState);
          lastState = coupledState;
          lastSimtime = nextTimeout;
          newTrace.push({kind: "bigstep", simtime: nextTimeout, state: coupledState, outputEvents, cause: {kind: "timer", simtime: nextTimeout}});
        }
      }
      const [outputEvents, coupledState] = cE.initial();
      const newTrace = [{kind: "bigstep", simtime: 0, state: coupledState, outputEvents, cause: {kind: "init"} as BigStepCause} as TraceItem] as [TraceItem, ...TraceItem[]];
      let lastState = coupledState;
      let lastSimtime = 0;
      for (const cause of causes) {
        if (cause.kind === "input") {
          run_until(cause.simtime); // <-- just make sure we haven't missed any timers elapsing
          // @ts-ignore
          const [outputEvents, coupledState] = cE.extTransition(cause.simtime, newTrace.at(-1)!.state, {kind: "input", name: cause.eventName, param: cause.param});
          lastState = coupledState;
          lastSimtime = cause.simtime;
          newTrace.push({kind: "bigstep", simtime: cause.simtime, state: coupledState, outputEvents, cause});
        }
        else if (cause.kind === "timer") {
          run_until(cause.simtime);
        }
      }
      setTrace({trace: newTrace, idx: newTrace.length-1});
      setTime({kind: "paused", simtime: lastSimtime});
    }
  }

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
            <PersistentDetailsLocalStorage localStorageKey="showStateTree" initiallyOpen={true}>
              <summary>state tree</summary>
              <ul>
                {ast && <ShowAST {...{...ast, trace, highlightActive}}/>}
              </ul>
            </PersistentDetailsLocalStorage>
            {/* Input events */}
            <PersistentDetailsLocalStorage localStorageKey="showInputEvents" initiallyOpen={true}>
              <summary>input events</summary>
              {ast && <ShowInputEvents
                inputEvents={ast.inputEvents}
                onRaise={(e,p) => onRaise("debug."+e,p)}
                disabled={trace===null || trace.trace[trace.idx].kind === "error"}
                showKeys={showKeys}/>}
            </PersistentDetailsLocalStorage>
            {/* Internal events */}
            <PersistentDetailsLocalStorage localStorageKey="showInternalEvents" initiallyOpen={true}>
              <summary>internal events</summary>
              {ast && <ShowInternalEvents internalEvents={ast.internalEvents}/>}
            </PersistentDetailsLocalStorage>
            {/* Output events */}
            <PersistentDetailsLocalStorage localStorageKey="showOutputEvents" initiallyOpen={true}>
              <summary>output events</summary>
              {ast && <ShowOutputEvents outputEvents={ast.outputEvents}/>}
            </PersistentDetailsLocalStorage>
            {/* Plant */}
            <PersistentDetailsLocalStorage localStorageKey="showPlant" initiallyOpen={true}>
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
            </PersistentDetailsLocalStorage>
            {/* Connections */}
            <PersistentDetails state={showConnections} setState={setShowConnections}>
              <summary>connections</summary>
              <button title="auto-connect (name-based)" className={autoConnect?"active":""}
                onClick={() => setAutoConnect(c => !c)}>
                <AutoAwesomeIcon fontSize="small"/>
              </button>
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
                  violated = result[0] && result[0].length > 0 && !result[0][0].satisfied;
                  propertyError = result[1];
                }
                return <div style={{width:'100%'}} key={i} className="toolbar">
                  <div className={"status" + (violated === null ? "" : (violated ? " violated" : " satisfied"))}></div>
                  <button title="see in trace (below)" className={activeProperty === i ? "active" : ""} onClick={() => setActiveProperty(i)}>
                    <VisibilityIcon fontSize="small"/>
                  </button>
                  <input type="text" style={{width:'calc(100% - 90px)'}} value={property} onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))}/>
                  <button title="delete this property" onClick={() => setProperties(properties => properties.toSpliced(i, 1))}>
                    <DeleteOutlineIcon fontSize="small"/>
                  </button>
                  {propertyError && <div style={{color: 'var(--error-color)'}}>{propertyError}</div>}
                </div>;
              })}
              <div className="toolbar">
                <button title="add property" onClick={() => setProperties(properties => [...properties, ""])}>
                  <AddIcon fontSize="small"/> add property
                </button>
              </div>
            </details>
            {/* Traces */}
            <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary>
              <div>
                {savedTraces.map((savedTrace, i) =>
                  <div key={i} className="toolbar">
                    <button title="replay trace (may give a different result if you changed your model since recording the trace because only input and timer events are recorded)" onClick={() => onReplayTrace(savedTrace[1])}>
                      <CachedOutlinedIcon fontSize="small"/>
                    </button>
                    &nbsp;
                    <span style={{display:'inline-block', width: 26, fontSize: 9}}>{(Math.floor(savedTrace[1].at(-1)!.simtime/1000))}s</span>
                    <span style={{display:'inline-block', width: 22, fontSize: 9}}>({savedTrace[1].length})</span>
                    &nbsp;
                    <input title="name of the trace (only for humans - names don't have to be unique or anything)" type="text" value={savedTrace[0]} style={{width: 'calc(100% - 124px)'}} onChange={e => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1, [e.target.value, savedTraces[i][1]]))}/>
                    <button title="forget trace" onClick={() => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1))}>
                      <DeleteOutlineIcon fontSize="small"/>
                    </button>
                  </div>
                )}
              </div>
              <div className="toolbar">
                <input id="checkbox-show-plant-items" type="checkbox" checked={showPlantTrace} onChange={e => setShowPlantTrace(e.target.checked)}/>
                <label title="plant steps are steps where only the state of the plant changed" htmlFor="checkbox-show-plant-items">show plant steps</label>
                <input id="checkbox-autoscroll" type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
                <label title="automatically scroll down event trace when new events occur" htmlFor="checkbox-autoscroll">auto-scroll</label>
                &emsp;
                <button title="save current trace" disabled={trace === null} onClick={() => onSaveTrace()}>
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

    {/* Plant UI events typically go to the Plant */}
    {plant.uiEvents.map(e => <div style={{width:'100%', textAlign:'right'}}>
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

export default App;

