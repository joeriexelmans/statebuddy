import { useState } from "react";

import { ConcreteState, emptyStatechart, Statechart, Transition } from "../VisualEditor/ast";

import { VisualEditor } from "../VisualEditor/VisualEditor";
import { RT_Statechart } from "../VisualEditor/runtime_types";
import { initialize, raiseEvent } from "../VisualEditor/interpreter";

import "../index.css";
import "./App.css";
import { Action, Expression } from "../VisualEditor/label_ast";

export function stateDescription(state: ConcreteState) {
  const description = state.comments.length > 0 ? state.comments[0][1] : state.uid;
  return description;
}

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
      <details open={true}>
        <summary>entry actions</summary>
        {props.root.entryActions.map(action =>
          <div>&emsp;<ShowAction action={action}/></div>
        )}
      </details>
    }
    {props.root.exitActions.length>0 &&
      <details open={true}>
        <summary>exit actions</summary>
        {props.root.exitActions.map(action =>
          <ShowAction action={action}/>
        )}
      </details>
    }
    {props.root.children.length>0 &&
      <details open={true}>
        <summary>children</summary>
          {props.root.children.map(child => 
            <AST root={child} transitions={props.transitions} />
          )}
      </details>
    }
    {outgoing.length>0 &&
      <details open={true}>
        <summary>outgoing</summary>
        {outgoing.map(transition => <>&emsp;<ShowTransition transition={transition}/><br/></>)}
      </details>
    }
  </details>
}


export function App() {
  const [ast, setAST] = useState<Statechart>(emptyStatechart);
  const [errors, setErrors] = useState<[string,string][]>([]);
  const [rt, setRT] = useState<RT_Statechart|null>(null);

  const [paused, setPaused] = useState(true);
  const [timescale, setTimescale] = useState(1);

  function restart() {
    const rt = initialize(ast);
    console.log('runtime: ', rt);
    setRT(rt);
  }

  function stop() {
    setRT(null);
  }

  function raise(event: string) {
    if (rt && ast.inputEvents.has(event)) {
      const nextConfigs = raiseEvent(event, ast, ast.root, rt)
      console.log({nextConfigs});
      if (nextConfigs.length > 0) {
        if (nextConfigs.length > 1) {
          console.warn('non-determinism, blindly selecting first next run-time state!');
        }
        setRT(nextConfigs[0]);
      }
    }
  }

  return <div className="layoutVertical">
    <div className="panel">
      <button onClick={restart}>(re)start</button>
      <select disabled={rt===null} value="raise event..." onChange={e => raise(e.target.value)}>
        <option value="">raise event...</option>
        {[...ast.inputEvents].map(event =>
          <option value={event}>{event}</option>
        )}
      </select>
      <button onClick={stop} >stop</button>
      &emsp;
      <input type="radio" name="paused" id="radio-paused" checked={paused} disabled={rt===null}/>
      <label htmlFor="radio-paused">paused</label>
      <input type="radio" name="realtime" id="radio-realtime" checked={!paused} disabled={rt===null}/>
      <label htmlFor="radio-realtime">real-time</label>
      &emsp;
      <label htmlFor="number-timescale">timescale</label>
      <input type="number" id="number-timescale" disabled={rt===null} value={timescale} style={{width:40}}/>
    </div>
    <div className="layout">
      <main className="content">
        <VisualEditor {...{ast, setAST, rt, setRT, errors, setErrors}}/>
      </main>
      <aside className="sidebar">
        <AST {...ast}/>
        <hr/>
        {rt &&
          [...rt.environment.entries()].map(([variable,value]) => <>
            {variable}: {value}<br/>
          </>)
        }
      </aside>
    </div>
  </div>;
}

export default App;
