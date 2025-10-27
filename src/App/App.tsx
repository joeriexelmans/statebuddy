import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { handleInputEvent, initialize, RuntimeError } from "../statecharts/interpreter";
import { BigStepOutput, RT_Event, RT_Statechart } from "../statecharts/runtime_types";
import { InsertMode, VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";

import "../index.css";
import "./App.css";

import { TopPanel } from "./TopPanel/TopPanel";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { parseStatechart } from "../statecharts/parser";
import { getKeyHandler } from "./VisualEditor/shortcut_handler";
import { BottomPanel } from "./BottomPanel";
import { emptyState } from "@/statecharts/concrete_syntax";
import { PersistentDetails } from "./PersistentDetails";
import { DigitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";
import { DummyPlant } from "./Plant/Dummy/Dummy";
import { Plant } from "./Plant/Plant";
import { usePersistentState } from "./persistent_state";
import { RTHistory } from "./RTHistory";
import { detectConnections } from "@/statecharts/detect_connections";
import { MicrowavePlant } from "./Plant/Microwave/Microwave";
import { coupledExecution, dummyExecution, exposeStatechartInputs, statechartExecution, TimedReactive } from "@/statecharts/timed_reactive";

// const clock1: TimedReactive<{nextTick: number}> = {
//   initial: () => ({nextTick: 1}),
//   timeAdvance: (c) => c.nextTick,
//   intTransition: (c) => [[{name: "tick"}], {nextTick: c.nextTick+1}],
//   extTransition: (simtime, c, e) => [[], (c)],
// }

// const clock2: TimedReactive<{nextTick: number}> = {
//   initial: () => ({nextTick: 0.5}),
//   timeAdvance: (c) => c.nextTick,
//   intTransition: (c) => [[{name: "tick"}], {nextTick: c.nextTick+1}],
//   extTransition: (simtime, c, e) => [[], (c)],
// }

// const coupled = coupledExecution({clock1, clock2}, {inputEvents: {}, outputEvents: {
//   clock1: {tick: {kind:"output", eventName: 'tick'}},
//   clock2: {tick: {kind:"output", eventName: 'tick'}},
// }})

// let state = coupled.initial();
// for (let i=0; i<10; i++) {
//   const nextWakeup = coupled.timeAdvance(state);
//   console.log({state, nextWakeup});
//   [[], state] = coupled.intTransition(state);
// }

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

const plants: [string, Plant<any>][] = [
  ["dummy", DummyPlant],
  ["digital watch", DigitalWatchPlant],
  ["microwave", MicrowavePlant],
]

export type TraceItemError = {
  cause: string, // event name, <init> or <timer>
  simtime: number,
  error: RuntimeError,
}

type CoupledState = {
  sc: BigStepOutput,
  plant: any,
};

export type TraceItem =
  { kind: "error" } & TraceItemError
| { kind: "bigstep", simtime: number, cause: string, state: CoupledState };

export type TraceState = {
  // executor: TimedReactive<CoupledState>,
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
}; // <-- null if there is no trace

function current(ts: TraceState) {
  return ts.trace[ts.idx]!;
}

// function getPlantState<T>(plant: Plant<T>, trace: TraceItem[], idx: number): T | null {
//   if (idx === -1) {
//     return plant.initial;
//   }
//   let plantState = getPlantState(plant, trace, idx-1);
//   if (plantState !== null) {
//     const currentConfig = trace[idx];
//     if (currentConfig.kind === "bigstep") {
//       for (const o of currentConfig.outputEvents) {
//         plantState = plant.reduce(o, plantState);
//       }
//     }
//     return plantState;
//   }
//   return null;
// }

export function App() {
  const [insertMode, setInsertMode] = useState<InsertMode>("and");
  const [editHistory, setEditHistory] = useState<EditHistory|null>(null);
  const [trace, setTrace] = useState<TraceState|null>(null);
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [modal, setModal] = useState<ReactElement|null>(null);

  const [plantName, setPlantName] = usePersistentState("plant", "dummy");
  const [zoom, setZoom] = usePersistentState("zoom", 1);
  const [showKeys, setShowKeys] = usePersistentState("shortcuts", true);

  const plant = plants.find(([pn, p]) => pn === plantName)![1];

  const editorState = editHistory && editHistory.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => historyState && ({...historyState, current: cb(historyState.current)}));
  }, [setEditHistory]);

  // recover editor state from URL - we need an effect here because decompression is asynchronous
  useEffect(() => {
    console.log('recovering state...');
    const compressedState = window.location.hash.slice(1);
    if (compressedState.length === 0) {
      // empty URL hash
      console.log("no state to recover");
      setEditHistory(() => ({current: emptyState, history: [], future: []}));
      return;
    }
    let compressedBuffer;
    try {
      compressedBuffer = Uint8Array.fromBase64(compressedState); // may throw
    } catch (e) {
      // probably invalid base64
      console.error("failed to recover state:", e);
      setEditHistory(() => ({current: emptyState, history: [], future: []}));
      return;
    }
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(compressedBuffer).catch(() => {}); // any promise rejections will be detected when we try to read
    writer.close().catch(() => {});
    new Response(ds.readable).arrayBuffer()
      .then(decompressedBuffer => {
        const recoveredState = JSON.parse(new TextDecoder().decode(decompressedBuffer));
        setEditHistory(() => ({current: recoveredState, history: [], future: []}));
      })
      .catch(e => {
        // any other error: invalid JSON, or decompression failed.
        console.error("failed to recover state:", e);
        setEditHistory({current: emptyState, history: [], future: []});
      });
  }, []);

  // save editor state in URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (editorState === null) {
        window.location.hash = "#";
        return;
      }
      const serializedState = JSON.stringify(editorState);
      const stateBuffer = new TextEncoder().encode(serializedState);
      const cs = new CompressionStream("deflate");
      const writer = cs.writable.getWriter();
      writer.write(stateBuffer);
      writer.close();
      // todo: cancel this promise handler when concurrently starting another compression job
      new Response(cs.readable).arrayBuffer().then(compressedStateBuffer => {
        const compressedStateString = new Uint8Array(compressedStateBuffer).toBase64();
        window.location.hash = "#"+compressedStateString;
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [editorState]);

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

  // append editor state to undo history
  const makeCheckPoint = useCallback(() => {
    setEditHistory(historyState => historyState && ({
      ...historyState,
      history: [...historyState.history, historyState.current],
      future: [],
    }));
  }, [setEditHistory]);
  const onUndo = useCallback(() => {
    setEditHistory(historyState => {
      if (historyState === null) return null;
      if (historyState.history.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.history.at(-1)!,
        history: historyState.history.slice(0,-1),
        future: [...historyState.future, historyState.current],
      }
    })
  }, [setEditHistory]);
  const onRedo = useCallback(() => {
    setEditHistory(historyState => {
      if (historyState === null) return null;
      if (historyState.future.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.future.at(-1)!,
        history: [...historyState.history, historyState.current],
        future: historyState.future.slice(0,-1),
      }
    });
  }, [setEditHistory]);

  const scrollDownSidebar = useCallback(() => {
    if (refRightSideBar.current) {
      const el = refRightSideBar.current;
      // hack: we want to scroll to the new element, but we have to wait until it is rendered...
      setTimeout(() => {
        el.scrollIntoView({block: "end", behavior: "smooth"});
      }, 50);
    }
  }, [refRightSideBar.current]);

  const cE = useMemo(() => ast && coupledExecution({sc: statechartExecution(ast), plant: dummyExecution}, exposeStatechartInputs(ast, "sc")), [ast]);

  const onInit = useCallback(() => {
    if (cE === null) return;
    const metadata = {simtime: 0, cause: "<init>"};
    try {
      const state = cE.initial(); // may throw if initialing the statechart results in a RuntimeError
      setTrace({
        trace: [{kind: "bigstep", ...metadata, state}],
        idx: 0,
      });
      // config = initialize(ast);
      // const item = {kind: "bigstep", ...timestampedEvent, ...config};
      // const plantState = getPlantState(plant, [item], 0);
      // setTrace({trace: [{...item, plantState}], idx: 0});
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        setTrace({
          trace: [{kind: "error", ...metadata, error}],
          idx: 0,
        });
        // setTrace({trace: [{kind: "error", ...timestampedEvent, error}], idx: 0});
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
          const [_, newState] = cE.extTransition(simtime, currentTraceItem.state, {kind: "input", name: inputEvent, param});
          return newState;
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
            const [_, newState] = cE.intTransition(currentTraceItem.state);
            return newState;
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

  function appendNewConfig(simtime: number, cause: string, computeNewState: () => CoupledState) {
    let newItem: TraceItem;
    const metadata = {simtime, cause}
    try {
      const state = computeNewState(); // may throw RuntimeError
      newItem = {kind: "bigstep", ...metadata, state};
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

  function onBack() {
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
  }

  useEffect(() => {
    console.log("Welcome to StateBuddy!");
    () => {
      console.log("Goodbye!");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = getKeyHandler(setInsertMode);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const currentBigStep = currentTraceItem && currentTraceItem.kind === "bigstep" && currentTraceItem;
  const highlightActive = (currentBigStep && currentBigStep.state.sc.mode) || new Set();
  const highlightTransitions = currentBigStep && currentBigStep.state.sc.firedTransitions || [];

  const [showExecutionTrace, setShowExecutionTrace] = usePersistentState("showExecutionTrace", true);

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
            {...{trace, time, setTime, onUndo, onRedo, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory}}
          />}
        </div>
        {/* Editor */}
        <div style={{flexGrow: 1, overflow: "auto"}}>
          {editorState && conns && syntaxErrors &&
            <VisualEditor {...{state: editorState, setState: setEditorState, conns, trace, setTrace, syntaxErrors: allErrors, insertMode, highlightActive, highlightTransitions, setModal, makeCheckPoint, zoom}}/>}
        </div>
      </div>

      {/* Right: sidebar */}
      <div style={{
        borderLeft: 1,
        borderColor: "divider",
        flex: '0 0 content',
        overflowY: "auto",
        overflowX: "visible",
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
                onRaise={onRaise}
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
              {/* {trace !== null && trace.trace[trace.idx].plantState &&
                <div>{
                  plant.render(
                    trace.trace[trace.idx].plantState,
                    event => onRaise(event.name, event.param),
                    time.kind === "paused" ? 0 : time.scale,
                  )
                }</div>} */}
            </PersistentDetails>
            <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary></details>
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
                  {ast && <RTHistory {...{ast, trace, setTrace, setTime}}/>}
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

export default App;
