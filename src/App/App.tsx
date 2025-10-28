import "../index.css";
import "./App.css";

import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { emptyState } from "@/statecharts/concrete_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { Conns, coupledExecution, EventDestination, exposeStatechartInputs, statechartExecution } from "@/statecharts/timed_reactive";
import { RuntimeError } from "../statecharts/interpreter";
import { parseStatechart } from "../statecharts/parser";
import { BigStep, RaisedEvent } from "../statecharts/runtime_types";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";
import { BottomPanel } from "./BottomPanel";
import { usePersistentState } from "./persistent_state";
import { PersistentDetails } from "./PersistentDetails";
import { DummyPlant } from "./Plant/Dummy/Dummy";
import { MicrowavePlant } from "./Plant/Microwave/Microwave";
import { autoConnect, exposePlantInputs, Plant } from "./Plant/Plant";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { TopPanel } from "./TopPanel/TopPanel";
import { getKeyHandler } from "./VisualEditor/shortcut_handler";
import { InsertMode, VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { addV2D, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, rotateRect90CCW, rotateRect90CW, scaleV2D, subtractV2D, Vec2D } from "@/util/geometry";
import { HISTORY_RADIUS } from "./parameters";
import { DigitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

const plants: [string, Plant<any>][] = [
  ["dummy", DummyPlant],
  ["microwave", MicrowavePlant],
  ["digital watch", DigitalWatchPlant],
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
  const onRotate = useCallback((direction: "ccw" | "cw") => {
    makeCheckPoint();
    setEditHistory(historyState => {
      if (historyState === null) return null;

      const selection = historyState.current.selection;

      if (selection.length === 0) {
        return historyState;
      }

      // determine bounding box... in a convoluted manner
      let minX = -Infinity, minY = -Infinity, maxX = Infinity, maxY = Infinity;

      function addPointToBBox({x,y}: Vec2D) {
        minX = Math.max(minX, x);
        minY = Math.max(minY, y);
        maxX = Math.min(maxX, x);
        maxY = Math.min(maxY, y);
      }

      for (const rt of historyState.current.rountangles) {
        if (selection.some(s => s.uid === rt.uid)) {
          addPointToBBox(rt.topLeft);
          addPointToBBox(addV2D(rt.topLeft, rt.size));
        }
      }
      for (const d of historyState.current.diamonds) {
        if (selection.some(s => s.uid === d.uid)) {
          addPointToBBox(d.topLeft);
          addPointToBBox(addV2D(d.topLeft, d.size));
        }
      }
      for (const arr of historyState.current.arrows) {
        if (selection.some(s => s.uid === arr.uid)) {
          addPointToBBox(arr.start);
          addPointToBBox(arr.end);
        }
      }
      for (const txt of historyState.current.texts) {
        if (selection.some(s => s.uid === txt.uid)) {
          addPointToBBox(txt.topLeft);
        }
      }
      const historySize = {x: HISTORY_RADIUS, y: HISTORY_RADIUS};
      for (const h of historyState.current.history) {
        if (selection.some(s => s.uid === h.uid)) {
          addPointToBBox(h.topLeft);
          addPointToBBox(addV2D(h.topLeft, scaleV2D(historySize, 2)));
        }
      }

      const center: Vec2D = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      };

      const mapIfSelected = (shape: {uid: string}, cb: (shape:any)=>any) => {
        if (selection.some(s => s.uid === shape.uid)) {
          return cb(shape);
        }
        else {
          return shape;
        }
      }

      return {
        ...historyState,
        current: {
          ...historyState.current,
          rountangles: historyState.current.rountangles.map(rt => mapIfSelected(rt, rt => {
            return {
              ...rt,
              ...(direction === "ccw"
                ? rotateRect90CCW(rt, center)
                : rotateRect90CW(rt, center)),
            }
          })),
          arrows: historyState.current.arrows.map(arr => mapIfSelected(arr, arr => {
            return {
              ...arr,
              ...(direction === "ccw"
                ? rotateLine90CCW(arr, center)
                : rotateLine90CW(arr, center)),
            };
          })),
          diamonds: historyState.current.diamonds.map(d => mapIfSelected(d, d => {
            return {
              ...d,
              ...(direction === "ccw"
                ? rotateRect90CCW(d, center)
                : rotateRect90CW(d, center)),
            };
          })),
          texts: historyState.current.texts.map(txt => mapIfSelected(txt, txt => {
              return {
                ...txt,
                topLeft: (direction === "ccw"
                  ? rotatePoint90CCW(txt.topLeft, center)
                  : rotatePoint90CW(txt.topLeft, center)),
              };
          })),
          history: historyState.current.history.map(h => mapIfSelected(h, h => {
              return {
                ...h,
                topLeft: (direction === "ccw"
                  ? subtractV2D(rotatePoint90CCW(addV2D(h.topLeft, historySize), center), historySize)
                  : subtractV2D(rotatePoint90CW(addV2D(h.topLeft, historySize), center), historySize)
                ),
              };
          })),
        },
      }
    })
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

  const plantConns = ast && ({
    inputEvents: {
      ...exposeStatechartInputs(ast, "sc", (eventName: string) => "DEBUG_"+eventName),
      ...exposePlantInputs(plant, "plant", (eventName: string) => "PLANT_UI_"+eventName),
    },
    outputEvents: autoConnect(ast, "sc", plant, "plant"),
  }) as Conns;
  const cE = useMemo(() => ast && coupledExecution({
    sc: statechartExecution(ast),
    plant: plant.execution,
  }, plantConns!), [ast]);

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
  const [showPlantTrace, setShowPlantTrace] = usePersistentState("showPlantTrace", false);

  const speed = time.kind === "paused" ? 0 : time.scale;

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
            <VisualEditor {...{state: editorState, setState: setEditorState, conns, trace, setTrace, syntaxErrors: allErrors, insertMode, highlightActive, highlightTransitions, setModal, makeCheckPoint, zoom}}/>}
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
                onRaise={(e,p) => onRaise("DEBUG_"+e,p)}
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
              {plantConns && <ShowConns {...plantConns} />}
              {currentBigStep && <plant.render state={currentBigStep.state.plant} speed={speed}
                raiseInput={e => onRaise("PLANT_UI_"+e.name, e.param)}
                />}
            </PersistentDetails>
            <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary>
              <input id="checkbox-show-plant-items" type="checkbox" checked={showPlantTrace} onChange={e => setShowPlantTrace(e.target.checked)}/><label htmlFor="checkbox-show-plant-items">show plant steps</label>
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
    <div style={{color: "grey"}}>
      {Object.entries(inputEvents).map(([eventName, destination]) => <div>{eventName} &#x2192; <ShowEventDestination {...destination}/></div>)}
    </div>
    {Object.entries(outputEvents).map(([modelName, mapping]) => <>{Object.entries(mapping).map(([eventName, destination]) => <div>{modelName}.{eventName} &#x2192; <ShowEventDestination {...destination}/></div>)}</>)}
  </div>;
}

export default App;
