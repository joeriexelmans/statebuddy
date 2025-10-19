import { ReactElement, useEffect, useRef, useState } from "react";

import { emptyStatechart, Statechart } from "../statecharts/abstract_syntax";
import { handleInputEvent, initialize } from "../statecharts/interpreter";
import { BigStep, BigStepOutput } from "../statecharts/runtime_types";
import { InsertMode, VisualEditor } from "../VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";

import "../index.css";
import "./App.css";

import { Box, Stack } from "@mui/material";
import { TopPanel } from "./TopPanel";
import { RTHistory } from "./RTHistory";
import { ShowAST, ShowOutputEvents } from "./ShowAST";
import { TraceableError } from "../statecharts/parser";
import { getKeyHandler } from "./shortcut_handler";
import { BottomPanel } from "./BottomPanel";

export function App() {
  const [mode, setMode] = useState<InsertMode>("and");
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<TraceableError[]>([]);
  const [rt, setRT] = useState<BigStep[]>([]);
  const [rtIdx, setRTIdx] = useState<number|undefined>();
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});

  const [modal, setModal] = useState<ReactElement|null>(null);

  const refRightSideBar = useRef<HTMLDivElement>(null);

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

  const highlightActive = (rtIdx === undefined) ? new Set() : rt[rtIdx].mode;

  const highlightTransitions = (rtIdx === undefined) ? [] : rt[rtIdx].firedTransitions;

  console.log(ast);

  return <>
  {/* Modal dialog */}
  {modal && <div
    onMouseDown={() => setModal(null)}
    style={{width: '100%', height: '100%', position:'absolute', textAlign: 'center', backgroundColor: 'rgba(127,127,127,0.5)' }}>
    <div
      style={{position: 'relative', top: '50%', transform: 'translateY(-50%)', textAlign: 'center', display: 'inline-block'}}>
      <span onMouseDown={e => e.stopPropagation()}>
      {modal}
      </span>
    </div>
  </div>}
  <Stack sx={{height:'100vh'}}>
    {/* Top bar */}
    <Box
      sx={{
        display: "flex",
        borderBottom: 1,
        borderColor: "divider",
        alignItems: 'center',
        flex: '0 0 content',
      }}>
      <TopPanel
        rt={rtIdx === undefined ? undefined : rt[rtIdx]}
        {...{rtIdx, ast, time, setTime, onInit, onClear, onRaise, onBack, mode, setMode, setModal}}
      />
    </Box>

    {/* Everything below the top bar */}
    <Stack direction="row" sx={{
      overflow: 'auto',
      }}>

      {/* main */}
      <Box sx={{
        flexGrow:1,
        overflow:'auto',
      }}>
        <VisualEditor {...{ast, setAST, rt: rt.at(rtIdx!), setRT, errors, setErrors, mode, highlightActive, highlightTransitions, setModal}}/>
      </Box>

      {/* right sidebar */}
      <Box
        sx={{
          borderLeft: 1,
          borderColor: "divider",
          flex: '0 0 content',
          overflow: "auto",
          maxWidth: 350,
        }}>
          <ShowAST {...{...ast, rt: rt.at(rtIdx!), highlightActive}}/>
          <ShowOutputEvents outputEvents={ast.outputEvents}/>
          <br/>
          <div ref={refRightSideBar}>
          <RTHistory {...{ast, rt, rtIdx, setTime, setRTIdx, refRightSideBar}}/>
          </div>
        </Box>
    </Stack>
    <Box sx={{
      flex: '0 0 content',
    }}>
      <BottomPanel {...{errors}}/>
    </Box>
  </Stack>
  </>;
}

export default App;
