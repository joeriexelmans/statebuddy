import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { handleInputEvent, initialize, RuntimeError } from "../statecharts/interpreter";
import { BigStep, RT_Event } from "../statecharts/runtime_types";
import { InsertMode, VisualEditor, VisualEditorState } from "../VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";

import "../index.css";
import "./App.css";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { TopPanel } from "./TopPanel";
import { ShowAST, ShowInputEvents, ShowInternalEvents, ShowOutputEvents } from "./ShowAST";
import { parseStatechart } from "../statecharts/parser";
import { getKeyHandler } from "./shortcut_handler";
import { BottomPanel } from "./BottomPanel";
import { emptyState } from "@/statecharts/concrete_syntax";
import { PersistentDetails } from "./PersistentDetails";
import { DigitalWatchPlant } from "@/Plant/DigitalWatch/DigitalWatch";
import { DummyPlant } from "@/Plant/Dummy/Dummy";
import { Plant } from "@/Plant/Plant";
import { usePersistentState } from "@/util/persistent_state";
import { RTHistory } from "./RTHistory";
import { detectConnections } from "@/statecharts/detect_connections";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

const plants: [string, Plant<any>][] = [
  ["dummy", DummyPlant],
  ["digital watch", DigitalWatchPlant],
]

export type BigStepError = {
  inputEvent: string,
  simtime: number,
  error: RuntimeError,
}

export type TraceItem = { kind: "error" } & BigStepError | { kind: "bigstep", plantState: any } & BigStep;

export type TraceState = {
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
}; // <-- null if there is no trace

function current(ts: TraceState) {
  return ts.trace[ts.idx]!;
}

function getPlantState<T>(plant: Plant<T>, trace: TraceItem[], idx: number): T | null {
  if (idx === -1) {
    return plant.initial;
  }
  let plantState = getPlantState(plant, trace, idx-1);
  if (plantState !== null) {
    const currentConfig = trace[idx];
    if (currentConfig.kind === "bigstep") {
      for (const o of currentConfig.outputEvents) {
        plantState = plant.reduce(o, plantState);
      }
    }
    return plantState;
  }
  return null;
}

export function App() {
  const [insertMode, setInsertMode] = useState<InsertMode>("and");
  const [historyState, setHistoryState] = useState<EditHistory>({current: emptyState, history: [], future: []});
  const [trace, setTrace] = useState<TraceState|null>(null);
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [modal, setModal] = useState<ReactElement|null>(null);

  const [plantName, setPlantName] = usePersistentState("plant", "dummy");
  const [zoom, setZoom] = usePersistentState("zoom", 1);
  const [showKeys, setShowKeys] = usePersistentState("shortcuts", true);

  const plant = plants.find(([pn, p]) => pn === plantName)![1];

  const editorState = historyState.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setHistoryState(historyState => ({...historyState, current: cb(historyState.current)}));
  }, [setHistoryState]);

  const refRightSideBar = useRef<HTMLDivElement>(null);

  // parse concrete syntax always:
  const conns = useMemo(() => detectConnections(editorState), [editorState]);
  const [ast, syntaxErrors] = useMemo(() => parseStatechart(editorState, conns), [editorState, conns]);

  // append editor state to undo history
  const makeCheckPoint = useCallback(() => {
    setHistoryState(historyState => ({
      ...historyState,
      history: [...historyState.history, historyState.current],
      future: [],
    }));
  }, [setHistoryState]);
  const onUndo = useCallback(() => {
    setHistoryState(historyState => {
      if (historyState.history.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.history.at(-1)!,
        history: historyState.history.slice(0,-1),
        future: [...historyState.future, historyState.current],
      }
    })
  }, [setHistoryState]);
  const onRedo = useCallback(() => {
    setHistoryState(historyState => {
      if (historyState.future.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.future.at(-1)!,
        history: [...historyState.history, historyState.current],
        future: historyState.future.slice(0,-1),
      }
    });
  }, [setHistoryState]);
  
  function onInit() {
    const timestampedEvent = {simtime: 0, inputEvent: "<init>"};
    let config;
    try {
      config = initialize(ast);
      const item = {kind: "bigstep", ...timestampedEvent, ...config};
      const plantState = getPlantState(plant, [item], 0);
      setTrace({trace: [{...item, plantState}], idx: 0});
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        setTrace({trace: [{kind: "error", ...timestampedEvent, error}], idx: 0});
      }
      else {
        throw error; // probably a bug in the interpreter
      }
    }
    setTime({kind: "paused", simtime: 0});
    scrollDownSidebar();
  }
  const onClear = useCallback(() => {
    setTrace(null);
    setTime({kind: "paused", simtime: 0});
  }, [setTrace, setTime]);

  // raise input event, producing a new runtime configuration (or a runtime error)
  const onRaise = (inputEvent: string, param: any) => {
    if (trace !== null && ast.inputEvents.some(e => e.event === inputEvent)) {
      const config = current(trace);
      if (config.kind === "bigstep") {
        const simtime = getSimTime(time, Math.round(performance.now()));
        produceNextConfig(simtime, {kind: "input", name: inputEvent, param}, config);
      }
    }
  };
  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (trace !== null) {
      const config = current(trace);
      if (config.kind === "bigstep") {
        const timers = config.environment.get("_timers") || [];
        if (timers.length > 0) {
          const [nextInterrupt, timeElapsedEvent] = timers[0];
          const raiseTimeEvent = () => {
            produceNextConfig(nextInterrupt, timeElapsedEvent, config);
          }
          // depending on whether paused or realtime, raise immediately or in the future:
          if (time.kind === "realtime") {
            const wallclkDelay = getWallClkDelay(time, nextInterrupt, Math.round(performance.now()));
            timeout = setTimeout(raiseTimeEvent, wallclkDelay);
          }
          else if (time.kind === "paused") {
            if (nextInterrupt <= time.simtime) {
              raiseTimeEvent();
            }
          }
        }
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [time, trace]); // <-- todo: is this really efficient?
  function produceNextConfig(simtime: number, event: RT_Event, config: TraceItem) {
    const timedEvent = {
      simtime,
      inputEvent: event.kind === "timer" ? "<timer>" : event.name,
    };

    let newItem: TraceItem;
    try {
      const nextConfig = handleInputEvent(simtime, event, ast, config as BigStep); // may throw
      let plantState = config.plantState;
      for (const o of nextConfig.outputEvents) {
        plantState = plant.reduce(o, plantState);
      }
      console.log({plantState});
      newItem = {kind: "bigstep", plantState, ...timedEvent, ...nextConfig};
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        newItem = {kind: "error", ...timedEvent, error};
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

  const scrollDownSidebar = useCallback(() => {
    if (refRightSideBar.current) {
      const el = refRightSideBar.current;
      // hack: we want to scroll to the new element, but we have to wait until it is rendered...
      setTimeout(() => {
        el.scrollIntoView({block: "end", behavior: "smooth"});
      }, 50);
    }
  }, []);

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

  let highlightActive: Set<string>;
  let highlightTransitions: string[];
  if (trace === null) {
    highlightActive = new Set();
    highlightTransitions = [];
  }
  else {
    const item = current(trace);
    console.log(trace);
    if (item.kind === "bigstep") {
      highlightActive = item.mode;
      highlightTransitions = item.firedTransitions;
    }
    else {
      highlightActive = new Set();
      highlightTransitions = [];
    }
  }

  // const plantState = trace && getPlantState(plant, trace.trace, trace.idx);

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

  <Stack sx={{height:'100%'}}>
    <Stack direction="row" sx={{flexGrow:1, overflow: "auto"}}>

      {/* Left: top bar and main editor */}
      <Box sx={{flexGrow:1, overflow: "auto"}}>
        <Stack sx={{height:'100%'}}>
          {/* Top bar */}
          <Box
            className="shadowBelow"
            sx={{
              display: "flex",
              borderBottom: 1,
              borderColor: "divider",
              alignItems: 'center',
              flex: '0 0 content',
            }}
          >
            <TopPanel
              {...{trace, ast, time, setTime, onUndo, onRedo, onInit, onClear, onRaise, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, history: historyState}}
            />
          </Box>
          {/* Below the top bar: Editor */}
          <Box sx={{flexGrow:1, overflow: "auto"}}>
            <VisualEditor {...{state: editorState, setState: setEditorState, conns, trace, setTrace, syntaxErrors, insertMode, highlightActive, highlightTransitions, setModal, makeCheckPoint, zoom}}/>
          </Box>
        </Stack>
      </Box>

      {/* Right: sidebar */}
      <Box sx={{
        borderLeft: 1,
        borderColor: "divider",
        flex: '0 0 content',
        overflowY: "auto",
        overflowX: "visible",
        maxWidth: 'min(300px, 30vw)',
      }}>
        <Stack sx={{height:'100%'}}>
          <Box
            className={showExecutionTrace ? "shadowBelow" : ""}
            sx={{flex: '0 0 content', backgroundColor: ''}}
          >
            <PersistentDetails localStorageKey="showStateTree" initiallyOpen={true}>
              <summary>state tree</summary>
              <ul>
                <ShowAST {...{...ast, trace, highlightActive}}/>
              </ul>
            </PersistentDetails>
            <PersistentDetails localStorageKey="showInputEvents" initiallyOpen={true}>
              <summary>input events</summary>
              <ShowInputEvents
                inputEvents={ast.inputEvents}
                onRaise={onRaise}
                disabled={trace===null || trace.trace[trace.idx].kind === "error"}
                showKeys={showKeys}/>
            </PersistentDetails>
            <PersistentDetails localStorageKey="showInternalEvents" initiallyOpen={true}>
              <summary>internal events</summary>
              <ShowInternalEvents internalEvents={ast.internalEvents}/>
            </PersistentDetails>
            <PersistentDetails localStorageKey="showOutputEvents" initiallyOpen={true}>
              <summary>output events</summary>
              <ShowOutputEvents outputEvents={ast.outputEvents}/>
            </PersistentDetails>
            <PersistentDetails localStorageKey="showPlant" initiallyOpen={true}>
              <summary>plant</summary>
              <select
                value={plantName}
                onChange={e => setPlantName(() => e.target.value)}>
                {plants.map(([plantName, p]) =>
                  <option>{plantName}</option>
                )}
              </select>
              {trace !== null &&
                plant.render(trace.trace[trace.idx].plantState, event => onRaise(event.name, event.param))}
            </PersistentDetails>
            <details open={showExecutionTrace} onToggle={e => setShowExecutionTrace(e.newState === "open")}><summary>execution trace</summary></details>
          </Box>

          {showExecutionTrace &&
            <Box sx={{
              flexGrow:1,
              overflow:'auto',
              minHeight: '50vh',
              // minHeight: '75%', // <-- allows us to always scroll down the sidebar far enough such that the execution history is enough in view
              }}>
                {/* <PersistentDetails localStorageKey="showExecutionTrace" initiallyOpen={true}> */}
                  {/* <summary>execution trace</summary> */}
                  <div ref={refRightSideBar}>
                    <RTHistory {...{ast, trace, setTrace, setTime}}/>
                  </div>
                {/* </PersistentDetails> */}
            </Box>}

          <Box sx={{flex: '0 0 content'}}>
          </Box>
        </Stack>
      </Box>


    </Stack>

    {/* Bottom panel */}
    <Box sx={{flex: '0 0 content'}}>
      <BottomPanel {...{errors: syntaxErrors}}/>
    </Box>
  </Stack>
  </>;
}

export default App;
