import { useEffect, useState } from "react";

import { ConcreteState, emptyStatechart, Statechart, stateDescription, Transition } from "../VisualEditor/ast";
import { handleInputEvent, initialize } from "../VisualEditor/interpreter";
import { TimerElapseEvent, Timers } from "@/VisualEditor/runtime_types";
import { Action, Expression } from "../VisualEditor/label_ast";
import { BigStep, BigStepOutput, Environment, Mode } from "../VisualEditor/runtime_types";
import { VisualEditor } from "../VisualEditor/VisualEditor";
import { getSimTime, getWallClkDelay, setPaused, setRealtime, TimeMode } from "../VisualEditor/time";

import "../index.css";
import "./App.css";

export function ShowTransition(props: {transition: Transition}) {
  return <>&#10132; {stateDescription(props.transition.tgt)}</>;
}

export function ShowExpr(props: {expr: Expression}) {
  if (props.expr.kind === "literal") {
    return <>{props.expr.value}</>;
  }
  else if (props.expr.kind === "ref") {
    return <>{props.expr.variable}</>;
  }
  else if (props.expr.kind === "unaryExpr") {
    return <>{props.expr.operator}<ShowExpr expr={props.expr.expr}/></>;
  }
  else if (props.expr.kind === "binaryExpr") {
    return <><ShowExpr expr={props.expr.lhs}/>{props.expr.operator}<ShowExpr expr={props.expr.rhs}/></>;
  }
}

export function ShowAction(props: {action: Action}) {
  if (props.action.kind === "raise") {
    return <>^{props.action.event}</>;
  }
  else if (props.action.kind === "assignment") {
    return <>{props.action.lhs} = <ShowExpr expr={props.action.rhs}/>;</>;
  }
}

export function AST(props: {root: ConcreteState, transitions: Map<string, Transition[]>}) {
  const description = stateDescription(props.root);
  const outgoing = props.transitions.get(props.root.uid) || [];

  return <details open={true}>
    <summary>{props.root.kind}: {description}</summary>

    {props.root.entryActions.length>0 &&
        props.root.entryActions.map(action =>
          <div>&emsp;entry / <ShowAction action={action}/></div>
        )
    }
    {props.root.exitActions.length>0 &&
        props.root.exitActions.map(action =>
          <div>&emsp;exit / <ShowAction action={action}/></div>
        )
    }
    {props.root.children.length>0 &&
          props.root.children.map(child => 
            <AST root={child} transitions={props.transitions} />
          )
    }
    {outgoing.length>0 &&
        outgoing.map(transition => <>&emsp;<ShowTransition transition={transition}/><br/></>)
    }
  </details>
}


function formatTime(timeMs: number) {
  const leadingZeros = "00" + Math.floor(timeMs) % 1000;
  const formatted = `${Math.floor(timeMs / 1000)}.${(leadingZeros).substring(leadingZeros.length-3)}`;
  return formatted;
}

function compactTime(timeMs: number) {
  if (timeMs % 1000 === 0) {
    return `${timeMs / 1000}s`;
  } 
  return `${timeMs} ms`;
}


export function App() {
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<[string,string][]>([]);

  const [rt, setRT] = useState<BigStep[]>([]);
  const [rtIdx, setRTIdx] = useState<number|null>(null);

  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [timescale, setTimescale] = useState(1);
  const [displayTime, setDisplayTime] = useState("0.000");


  function restart() {
    const config = initialize(ast);
    console.log('runtime: ', rt);
    setRT([{inputEvent: null, simtime: 0, ...config}]);
    setRTIdx(0);
    setTime({kind: "paused", simtime: 0});
 }

  function clear() {
    setRT([]);
    setRTIdx(null);
    setTime({kind: "paused", simtime: 0});
  }

  function raise(inputEvent: string) {
    if (rt.length>0 && rtIdx!==null && ast.inputEvents.has(inputEvent)) {
      const simtime = getSimTime(time, performance.now());
      const nextConfig = handleInputEvent(simtime, inputEvent, ast, rt[rtIdx]!);
      appendNewConfig(inputEvent, simtime, nextConfig);
    }
  }

  function appendNewConfig(inputEvent: string, simtime: number, config: BigStepOutput) {
    setRT([...rt.slice(0, rtIdx!+1), {inputEvent, simtime, ...config}]);
    setRTIdx(rtIdx!+1);
  }

  function updateDisplayedTime() {
    const now = performance.now();
    const timeMs = getSimTime(time, now);
    setDisplayTime(formatTime(timeMs));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      updateDisplayedTime();
    }, 20);

    let timeout: NodeJS.Timeout | undefined;
    if (rtIdx !== null) {
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
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    }

  }, [time, rtIdx]);

  function onChangePaused(paused: boolean, wallclktime: number) {
    setTime(time => {
      if (paused) {
        return setPaused(time, performance.now());
      }
      else {
        return setRealtime(time, timescale, wallclktime);
      }
    });
    updateDisplayedTime();
  }

  function onTimeScaleChange(newValue: string, wallclktime: number) {
    const asFloat = parseFloat(newValue);
    if (Number.isNaN(asFloat)) {
      return;
    }
    setTimescale(asFloat);
    setTime(time => {
      if (time.kind === "paused") {
        return time;
      }
      else {
        return setRealtime(time, asFloat, wallclktime);
      }
    })
  }
  
  function gotoRt(idx: number, timestamp: number) {
    setRTIdx(idx);
    setTime({kind: "paused", simtime: timestamp});
  }

  // timestamp of next timed transition, in simulated time
  const timers: Timers = (rt[rtIdx!]?.environment.get("_timers") || []);
  const nextTimedTransition: [number, TimerElapseEvent] | undefined = timers[0];

  return <div className="layoutVertical">
    <div className="panel">

    </div>
    <div className="panel">
      <button onClick={restart}>(re)start</button>
      <button onClick={clear} disabled={rtIdx===null}>clear</button>
      &emsp;
      {ast.inputEvents &&
        <>raise&nbsp;
        {[...ast.inputEvents].map(event => <button title="raise input event" disabled={rtIdx===null} onClick={() => raise(event)}>{event}</button>)}
        &emsp;</>
      }
      <input type="radio" name="paused" id="radio-paused" checked={time.kind==="paused"} disabled={rtIdx===null} onChange={e => onChangePaused(e.target.checked, performance.now())}/>
      <label htmlFor="radio-paused">paused</label>
      <input type="radio" name="realtime" id="radio-realtime" checked={time.kind==="realtime"} disabled={rtIdx===null} onChange={e => onChangePaused(!e.target.checked, performance.now())}/>
      <label htmlFor="radio-realtime">real time</label>
      &emsp;
      <label htmlFor="number-timescale">timescale</label>&nbsp;
      <input title="controls how fast the simulation should run in real time mode - larger than 1 means: faster than wall-clock time" type="number" min={0} id="number-timescale" disabled={rtIdx===null} value={timescale} style={{width:40}} onChange={e => onTimeScaleChange(e.target.value, performance.now())}/>
      &emsp;
      <label htmlFor="time">time (s)</label>&nbsp;
      <input title="the current simulated time" id="time" disabled={rtIdx===null} value={displayTime} readOnly={true} className="readonlyTextBox" />
      {nextTimedTransition &&
        <>
        &emsp;
        <label htmlFor="next-timeout">next timeout (s)</label>&nbsp;
        <input id="next-timeout" disabled={rtIdx===null} value={formatTime(nextTimedTransition[0])} readOnly={true} className="readonlyTextBox"/>
        <button title="advance time to the next timer elapse" onClick={() => {
          const now = performance.now();
          setTime(time => {
            if (time.kind === "paused") {
              return {kind: "paused", simtime: nextTimedTransition[0]};
            }
            else {
              return {kind: "realtime", scale: time.scale, since: {simtime: nextTimedTransition[0], wallclktime: now}};
            }
          });
        }}>advance</button>
        </>
      }
    </div>

    <div className="layout">
      <main className="content">
        <VisualEditor {...{ast, setAST, rt: rt.at(rtIdx!), setRT, errors, setErrors}}/>
      </main>
      <aside className="sidebar">
        <AST {...ast}/>
        {rt.map((rt, idx) => <><hr/><div className={"runtimeState"+(idx===rtIdx?" active":"")} onClick={() => gotoRt(idx, rt.simtime)}>
          <div>({formatTime(rt.simtime)}, {rt.inputEvent || "<init>"})</div>
          <ShowMode mode={rt.mode} statechart={ast}/>
          <ShowEnvironment environment={rt.environment}/>
          {rt.outputEvents.length>0 && <div>
            {rt.outputEvents.map((e:string) => '^'+e).join(', ')}
          </div>}
        </div></>)}
      </aside>
    </div>
  </div>;
}

function ShowEnvironment(props: {environment: Environment}) {
  return <div>{[...props.environment.entries()]
    .filter(([variable]) => !variable.startsWith('_'))
    .map(([variable,value]) =>
    `${variable}: ${value}`
  ).join(', ')}</div>;
}

function ShowMode(props: {mode: Mode, statechart: Statechart}) {
  const activeLeafs = getActiveLeafs(props.mode, props.statechart);
  return <div>mode: {[...activeLeafs].map(uid =>
    stateDescription(props.statechart.uid2State.get(uid)!)).join(", ")}</div>;
}

function getActiveLeafs(mode: Mode, sc: Statechart) {
  const toDelete = [];
  for (const stateA of mode) {
    for (const stateB of mode) {
      if (sc.uid2State.get(stateA)!.parent === sc.uid2State.get(stateB)) {
        toDelete.push(stateB);
      }
    }
  }
  return mode.difference(new Set(toDelete));
}

export default App;
