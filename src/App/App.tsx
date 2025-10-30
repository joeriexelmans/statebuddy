import "../index.css";
import "./App.css";

import { Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectConnections } from "@/statecharts/detect_connections";
import { Conns, coupledExecution, EventDestination, statechartExecution, TimedReactive } from "@/statecharts/timed_reactive";
import { RuntimeError } from "../statecharts/interpreter";
import { parseStatechart } from "../statecharts/parser";
import { BigStep, RaisedEvent } from "../statecharts/runtime_types";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";
import { BottomPanel } from "./BottomPanel";
import { usePersistentState } from "./persistent_state";
import { PersistentDetails } from "./PersistentDetails";
import { dummyPlant } from "./Plant/Dummy/Dummy";
import { microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { TopPanel } from "./TopPanel/TopPanel";
import { VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { digitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";
import { useEditor as useEditor } from "./useEditor";
import { InsertMode } from "./TopPanel/InsertModes";
import { Statechart } from "@/statecharts/abstract_syntax";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

const plants: [string, Plant<any>][] = [
  ["dummy", dummyPlant],
  ["microwave", microwavePlant],
  ["digital watch", digitalWatchPlant],
]

export type TraceItemError = {
  cause: string, // event name, <init> or <timer>
  simtime: number,
  error: RuntimeError,
}

type CoupledState = {
  sc: BigStep,
  plant: BigStep,
};

export type TraceItem =
  { kind: "error" } & TraceItemError
| { kind: "bigstep", simtime: number, cause: string, state: CoupledState, outputEvents: RaisedEvent[] };

export type TraceState = {
  // executor: TimedReactive<CoupledState>,
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
}; // <-- null if there is no trace

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
  ]

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

  // const plantConns = ast && ({
  //   inputEvents: {
  //     // all SC inputs are directly triggerable from outside
  //     ...exposeStatechartInputs(ast, "sc", (eventName: string) => "debug."+eventName),

  //     ...Object.fromEntries(plant.uiEvents.map(e => {
  //       const globalName = "PLANT_UI_"+e.event;
  //       if (plant.inputEvents.some(f => f.event === e.event)) {
  //         return [globalName, {kind: "model", model: 'plant', eventName: e.event}];
  //       }
  //       if (ast.inputEvents.some(f => f.event === e.event)) {
  //         return [globalName, {kind: "model", model: 'sc', eventName: e.event}];
  //       }
  //     }).filter(entry => entry !== undefined)),
  //   },
  //   outputEvents: {}, //autoConnect(ast, "sc", plant, "plant"),
  // }) as Conns;
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
  }, [time, trace]); // <-- todo: is this really efficient?

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
            <PersistentDetails localStorageKey="showStateTree" initiallyOpen={true}>
              <summary>state tree</summary>
              <ul>
                {ast && <ShowAST {...{...ast, trace, highlightActive}}/>}
              </ul>
            </PersistentDetails>
            <PersistentDetails localStorageKey="showInputEvents" initiallyOpen={true}>
              <summary>input events</summary>
              {ast && <ShowInputEvents
                inputEvents={ast.inputEvents}
                onRaise={(e,p) => onRaise("debug."+e,p)}
                disabled={trace===null || trace.trace[trace.idx].kind === "error"}
                showKeys={showKeys}/>}
            </PersistentDetails>
            <PersistentDetails localStorageKey="showInternalEvents" initiallyOpen={true}>
              <summary>internal events</summary>
              {ast && <ShowInternalEvents internalEvents={ast.internalEvents}/>}
            </PersistentDetails>
            <PersistentDetails localStorageKey="showOutputEvents" initiallyOpen={true}>
              <summary>output events</summary>
              {ast && <ShowOutputEvents outputEvents={ast.outputEvents}/>}
            </PersistentDetails>
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
              {/* Render plant */}
              {<plant.render state={plantState} speed={speed}
                raiseUIEvent={e => onRaise("plant.ui."+e.name, e.param)}
                />}
            </PersistentDetails>
              <PersistentDetails localStorageKey="showConnEditor" initiallyOpen={false}>
                <summary>connections</summary>
                <button title="auto-connect (name-based)" className={autoConnect?"active":""}
                  onClick={() => setAutoConnect(c => !c)}>
                  <AutoAwesomeIcon fontSize="small"/>
                </button>
                {ast && ConnEditor(ast, plant, plantConns, setPlantConns)}
              </PersistentDetails>

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
                  {ast && <RTHistory {...{ast, trace, setTrace, setTime, showPlantTrace}}/>}
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

function ShowEventDestination(dst: EventDestination) {
  if (dst.kind === "model") {
    return <>{dst.model}.{dst.eventName}</>;
  }
  else if (dst.kind === "output") {
    return <>{dst.eventName}</>;
  }
  else {
    return <>&#x1F5D1;</>; // <-- garbage can icon
  }
}

function ShowConns({inputEvents, outputEvents}: Conns) {
  return <div>
    {/* <div style={{color: "grey"}}>
      {Object.entries(inputEvents).map(([eventName, destination]) => <div>{eventName} &#x2192; <ShowEventDestination {...destination}/></div>)}
    </div>
    {Object.entries(outputEvents).map(([modelName, mapping]) => <>{Object.entries(mapping).map(([eventName, destination]) => <div>{modelName}.{eventName} &#x2192; <ShowEventDestination {...destination}/></div>)}</>)} */}
  </div>;
}

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

function autoDetectConns(ast: Statechart, plant: Plant<any>, setPlantConns: Dispatch<SetStateAction<Conns>>) {
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

function ConnEditor(ast: Statechart, plant: Plant<any>, plantConns: Conns, setPlantConns: Dispatch<SetStateAction<Conns>>) {
  const plantInputs = <>{plant.inputEvents.map(e => <option key={'plant.'+e.event} value={'plant.'+e.event}>plant.{e.event}</option>)}</>
  const scInputs = <>{ast.inputEvents.map(e => <option key={'sc.'+e.event} value={'sc.'+e.event}>sc.{e.event}</option>)}</>;
  return <>
    {/* Plant UI events can go to SC or to Plant */}
    {plant.uiEvents.map(e => <div>
      <label htmlFor={`select-dst-plant-ui-${e.event}`}>ui.{e.event}&nbsp;→&nbsp;</label>
      <select id={`select-dst-plant-ui-${e.event}`}
        value={plantConns['plant.ui.'+e.event]?.join('.')}
        onChange={domEvent => setPlantConns(conns => ({...conns, [`plant.ui.${e.event}`]: domEvent.target.value.split('.') as [string,string]}))}>
        <option key="none" value=""></option>
        {scInputs}
        {plantInputs}
      </select>
    </div>)}
    
    {/* SC output events can go to Plant */}
    {[...ast.outputEvents].map(e => <div>
      <label htmlFor={`select-dst-sc-${e}`}>sc.{e}&nbsp;→&nbsp;</label>
      <select id={`select-dst-sc-${e}`}
        value={plantConns['sc.'+e]?.join('.')}
        onChange={domEvent => setPlantConns(conns => ({...conns, [`sc.${e}`]: domEvent.target.value.split('.') as [string,string]}))}>
        <option key="none" value=""></option>
        {plantInputs}
      </select>
    </div>)}

    {/* Plant output events can go to Statechart */}
    {[...plant.outputEvents.map(e => <div>
      <label htmlFor={`select-dst-plant-${e.event}`}>plant.{e.event}&nbsp;→&nbsp;</label>
      <select id={`select-dst-plant-${e.event}`}
        value={plantConns['plant.'+e.event]?.join('.')}
        onChange={(domEvent => setPlantConns(conns => ({...conns, [`plant.${e.event}`]: domEvent.target.value.split('.') as [string,string]})))}>
        <option key="none" value=""></option>
        {scInputs}
      </select>
    </div>)]}
  </>;
}

export default App;

