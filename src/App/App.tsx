import { useEffect, useState } from "react";

import { emptyStatechart, Statechart } from "../statecharts/abstract_syntax";
import { handleInputEvent, initialize } from "../statecharts/interpreter";
import { BigStep, BigStepOutput } from "../statecharts/runtime_types";
import { VisualEditor } from "../VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, TimeMode } from "../statecharts/time";

import "../index.css";
import "./App.css";

import { Box, Stack } from "@mui/material";
import { TopPanel } from "./TopPanel";
import { RTHistory } from "./RTHistory";
import { AST } from "./AST";

export function App() {
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<[string,string][]>([]);

  const [rt, setRT] = useState<BigStep[]>([]);
  const [rtIdx, setRTIdx] = useState<number|undefined>();

  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});

  function onInit() {
    const config = initialize(ast);
    console.log('runtime: ', rt);
    setRT([{inputEvent: null, simtime: 0, ...config}]);
    setRTIdx(0);
    setTime({kind: "paused", simtime: 0});
 }

  function onClear() {
    setRT([]);
    setRTIdx(undefined);
    setTime({kind: "paused", simtime: 0});
  }

  function onRaise(inputEvent: string) {
    if (rt.length>0 && rtIdx!==undefined && ast.inputEvents.has(inputEvent)) {
      const simtime = getSimTime(time, performance.now());
      const nextConfig = handleInputEvent(simtime, inputEvent, ast, rt[rtIdx]!);
      appendNewConfig(inputEvent, simtime, nextConfig);
    }
  }

  function appendNewConfig(inputEvent: string, simtime: number, config: BigStepOutput) {
    setRT([...rt.slice(0, rtIdx!+1), {inputEvent, simtime, ...config}]);
    setRTIdx(rtIdx!+1);
  }

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
          const wallclkDelay = getWallClkDelay(time, nextInterrupt, performance.now());
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

  return <Stack sx={{height:'100vh'}}>
    {/* Top bar */}
    <Box
      sx={{
        display: "flex",
        borderBottom: 1,
        borderColor: "divider",
        alignItems: 'center',
      }}>
      <TopPanel
        rt={rtIdx === undefined ? undefined : rt[rtIdx]}
        {...{ast, time, setTime, onInit, onClear, onRaise}}
      />
    </Box>
    <Stack direction="row" sx={{height:'calc(100vh - 32px)'}}>
      {/* main */}
      <Box sx={{flexGrow:1, overflow:'auto'}}>
        <VisualEditor {...{ast, setAST, rt: rt.at(rtIdx!), setRT, errors, setErrors}}/>
      </Box>
      {/* right sidebar */}
      <Box
        sx={{
          borderLeft: 1,
          borderColor: "divider",
          flex: '0 0 content',
          paddingRight: 1,
          paddingLeft: 1,
        }}>
          <AST {...ast}/>
          <hr/>
          <RTHistory {...{ast, rt, rtIdx, setTime, setRTIdx}}/>
        </Box>
    </Stack>
  </Stack>;
}

export default App;
