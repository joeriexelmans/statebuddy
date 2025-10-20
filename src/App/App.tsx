import { Dispatch, ReactElement, SetStateAction, useEffect, useRef, useState } from "react";

import { emptyStatechart, Statechart } from "../statecharts/abstract_syntax";
import { handleInputEvent, initialize } from "../statecharts/interpreter";
import { BigStep, BigStepOutput } from "../statecharts/runtime_types";
import { InsertMode, VisualEditor } from "../VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";

import "../index.css";
import "./App.css";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { TopPanel } from "./TopPanel";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowInputEvents, ShowOutputEvents } from "./ShowAST";
import { TraceableError } from "../statecharts/parser";
import { getKeyHandler } from "./shortcut_handler";
import { BottomPanel } from "./BottomPanel";
import { emptyState, VisualEditorState } from "@/statecharts/concrete_syntax";
import { usePersistentState } from "@/util/persistent_state";

type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

export function App() {
  const [mode, setMode] = useState<InsertMode>("and");
  const [historyState, setHistoryState] = useState<EditHistory>({current: emptyState, history: [], future: []});
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<TraceableError[]>([]);
  const [rt, setRT] = useState<BigStep[]>([]);
  const [rtIdx, setRTIdx] = useState<number|undefined>();
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [modal, setModal] = useState<ReactElement|null>(null);

  const editorState = historyState.current;
  const setEditorState = (cb: (value: VisualEditorState) => VisualEditorState) => {
    setHistoryState(historyState => ({...historyState, current: cb(historyState.current)}));
  }

  const refRightSideBar = useRef<HTMLDivElement>(null);


  function makeCheckPoint() {
    setHistoryState(historyState => ({
      ...historyState,
      history: [...historyState.history, historyState.current],
      future: [],
    }));
  }
  function onUndo() {
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
  }
  function onRedo() {
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
  }
  
  function onInit() {
    const config = initialize(ast);
    setRT([{inputEvent: null, simtime: 0, ...config}]);
    setRTIdx(0);
    setTime({kind: "paused", simtime: 0});
    scrollDownSidebar();
 }

  function onClear() {
    setRT([]);
    setRTIdx(undefined);
    setTime({kind: "paused", simtime: 0});
  }

  function onRaise(inputEvent: string, param: any) {
    if (rt.length>0 && rtIdx!==undefined && ast.inputEvents.some(e => e.event === inputEvent)) {
      const simtime = getSimTime(time, Math.round(performance.now()));
      const nextConfig = handleInputEvent(simtime, {kind: "input", name: inputEvent, param}, ast, rt[rtIdx]!);
      appendNewConfig(inputEvent, simtime, nextConfig);
    }
  }

  function appendNewConfig(inputEvent: string, simtime: number, config: BigStepOutput) {
    setRT([...rt.slice(0, rtIdx!+1), {inputEvent, simtime, ...config}]);
    setRTIdx(rtIdx!+1);
    // console.log('new config:', config);
    scrollDownSidebar();
  }

  function onBack() {
    setTime(() => {
      if (rtIdx !== undefined) {
        if (rtIdx > 0)
          return {
            kind: "paused",
            simtime: rt[rtIdx-1].simtime,
          }
      }
      return { kind: "paused", simtime: 0 };
    });
    setRTIdx(rtIdx => {
      if (rtIdx !== undefined) {
        if (rtIdx > 0)
          return rtIdx - 1;
        else
          return 0;
      }
      else return undefined;
    })
  }

  function scrollDownSidebar() {
    if (refRightSideBar.current) {
      const el = refRightSideBar.current;
      // hack: we want to scroll to the new element, but we have to wait until it is rendered...
      setTimeout(() => {
        el.scrollIntoView({block: "end", behavior: "smooth"});
      }, 50);
    }
  }

  useEffect(() => {
    console.log("Welcome to StateBuddy!");
    () => {
      console.log("Goodbye!");
    }
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (rtIdx !== undefined) {
      const currentRt = rt[rtIdx]!;
      const timers = currentRt.environment.get("_timers") || [];
      if (timers.length > 0) {
        const [nextInterrupt, timeElapsedEvent] = timers[0];
        const raiseTimeEvent = () => {
          const nextConfig = handleInputEvent(nextInterrupt, timeElapsedEvent, ast, currentRt);
          appendNewConfig('<timer>', nextInterrupt, nextConfig);
        }
        if (time.kind === "realtime") {
          const wallclkDelay = getWallClkDelay(time, nextInterrupt, Math.round(performance.now()));
          // console.log('scheduling timeout after', wallclkDelay);
          timeout = setTimeout(raiseTimeEvent, wallclkDelay);
        }
        else if (time.kind === "paused") {
          if (nextInterrupt <= time.simtime) {
            raiseTimeEvent();
          }
        }
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    }

  }, [time, rtIdx]);

  useEffect(() => {
    const onKeyDown = getKeyHandler(setMode);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // const highlightActive = (rtIdx !== undefined) && new Set([...rt[rtIdx].mode].filter(uid => {
  //   const state = ast.uid2State.get(uid);
  //   return state && state.parent?.kind !== "and";
  // })) || new Set();

  const highlightActive: Set<string> = (rtIdx === undefined) ? new Set() : rt[rtIdx].mode;

  const highlightTransitions = (rtIdx === undefined) ? [] : rt[rtIdx].firedTransitions;

  const [showStateTree, setShowStateTree] = usePersistentState("showStateTree", true);
  const [showInputEvents, setShowInputEvents] = usePersistentState("showInputEvents", true);
  const [showOutputEvents, setShowOutputEvents] = usePersistentState("showOutputEvents", true);

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
          <Box sx={{
            display: "flex",
            borderBottom: 1,
            borderColor: "divider",
            alignItems: 'center',
            flex: '0 0 content',
          }}>
            <TopPanel
              rt={rtIdx === undefined ? undefined : rt[rtIdx]}
              {...{rtIdx, ast, time, setTime, onUndo, onRedo, onInit, onClear, onRaise, onBack, mode, setMode, setModal}}
            />
          </Box>
          {/* Below the top bar: Editor */}
          <Box sx={{flexGrow:1, overflow: "auto"}}>
            <VisualEditor {...{state: editorState, setState: setEditorState, ast, setAST, rt: rt.at(rtIdx!), setRT, errors, setErrors, mode, highlightActive, highlightTransitions, setModal, makeCheckPoint}}/>
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
          <Box className="onTop" sx={{flex: '0 0 content', backgroundColor: ''}}>
            <details open={showStateTree}
              onToggle={e => setShowStateTree(e.newState === "open")}>
              <summary>state tree</summary>
              <ul>
                <ShowAST {...{...ast, rt: rt.at(rtIdx!), highlightActive}}/>
              </ul>
            </details>
            <hr/>
            <details open={showInputEvents}
              onToggle={e => setShowInputEvents(e.newState === "open")}>
              <summary>input events</summary>
              <ShowInputEvents inputEvents={ast.inputEvents} onRaise={onRaise} disabled={rtIdx===undefined}/>
            </details>
            <hr/>
            <details open={showOutputEvents}
              onToggle={e => setShowOutputEvents(e.newState === "open")}>
              <summary>output events</summary>
              <ShowOutputEvents outputEvents={ast.outputEvents}/>
            </details>
          </Box>
          <Box sx={{
            flexGrow:1,
            overflow:'auto',
            minHeight: '75%', // <-- allows us to always scroll down the sidebar far enough such that the execution history is enough in view
            }}>
            <Box sx={{ height: '100%'}}>
              <div ref={refRightSideBar}>
                <RTHistory {...{ast, rt, rtIdx, setTime, setRTIdx, refRightSideBar}}/>
              </div>
            </Box>
          </Box>
        </Stack>
      </Box>


    </Stack>

    {/* Bottom panel */}
    <Box sx={{flex: '0 0 content'}}>
      <BottomPanel {...{errors}}/>
    </Box>
  </Stack>
  </>;
}

export default App;
