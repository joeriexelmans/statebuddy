import { useState } from "react";

import { ConcreteState, emptyStatechart, isAncestorOf, Statechart, stateDescription, Transition } from "../VisualEditor/ast";
import { VisualEditor } from "../VisualEditor/VisualEditor";
import { Environment, Mode, RT_Statechart } from "../VisualEditor/runtime_types";
import { initialize, handleEvent, handleInputEvent } from "../VisualEditor/interpreter";
import { Action, Expression } from "../VisualEditor/label_ast";

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
    return <>raise {props.action.event}</>;
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


export function App() {
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<[string,string][]>([]);
  const [rt, setRT] = useState<RT_Statechart[]>([]);
  const [rtIdx, setRTIdx] = useState<number|null>(null);
  const [timeMs, setTimeMs] = useState(0);

  const [paused, setPaused] = useState(true);
  const [timescale, setTimescale] = useState(1);

  function restart() {
    const rt = initialize(ast);
    console.log('runtime: ', rt);
    setRT([rt]);
    setRTIdx(0);
  }

  function stop() {
    setRT([]);
    setRTIdx(null);
  }

  function raise(event: string) {
    console.log(rtIdx);
    if (rt.length>0 && rtIdx!==null && ast.inputEvents.has(event)) {
      const nextConfig = handleInputEvent(event, ast, rt[rtIdx]!);
      setRT([...rt.slice(0, rtIdx+1), nextConfig]);
      setRTIdx(rtIdx+1);
    }
  }

  return <div className="layoutVertical">
    <div className="panel">

    </div>
    <div className="panel">
      <button onClick={restart}>(re)start</button>
      <button onClick={stop} disabled={rt===null}>stop</button>
      &emsp;
      raise
      {[...ast.inputEvents].map(event => <button disabled={rtIdx===null} onClick={() => raise(event)}>{event}</button>)}
      &emsp;
      <input type="radio" name="paused" id="radio-paused" checked={paused} disabled={rtIdx===null} onChange={e => setPaused(e.target.checked)}/>
      <label htmlFor="radio-paused">paused</label>
      <input type="radio" name="realtime" id="radio-realtime" checked={!paused} disabled={rtIdx===null} onChange={e => setPaused(!e.target.checked)}/>
      <label htmlFor="radio-realtime">real-time</label>
      &emsp;
      <label htmlFor="number-timescale">timescale</label>
      <input type="number" id="number-timescale" disabled={rtIdx===null} value={timescale} style={{width:40}}/>
      &emsp;
      time is {timeMs} ms
    </div>
    <div className="layout">
      <main className="content">
        <VisualEditor {...{ast, setAST, rt: rt.at(rtIdx!), setRT, errors, setErrors}}/>
      </main>
      <aside className="sidebar">
        <AST {...ast}/>
        {rt.map((rt, idx) => <><hr/><div className={"runtimeState"+(idx===rtIdx?" active":"")} onClick={() => setRTIdx(idx)}>
          <ShowEnvironment environment={rt.environment}/>
          <br/>
          <ShowMode mode={rt.mode} statechart={ast}/>
        </div></>)}
      </aside>
    </div>
  </div>;
}

function ShowEnvironment(props: {environment: Environment}) {
  return <>{[...props.environment.entries()].map(([variable,value]) =>
    `${variable}: ${value}`
  ).join(', ')}</>;
}

function ShowMode(props: {mode: Mode, statechart: Statechart}) {
  const activeLeafs = getActiveLeafs(props.mode, props.statechart);
  return <>{[...activeLeafs].map(uid =>
    stateDescription(props.statechart.uid2State.get(uid)!)).join(",")}</>;
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
