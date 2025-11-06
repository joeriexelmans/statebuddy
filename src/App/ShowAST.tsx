import { ConcreteState, UnstableState, stateDescription, Transition } from "../statecharts/abstract_syntax";
import { Action, EventTrigger, Expression } from "../statecharts/label_ast";

import "./AST.css";

export function ShowTransition(props: {transition: Transition}) {
  return <>➝ {stateDescription(props.transition.tgt)}</>;
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
    return <>^<span className="outputEvent">{props.action.event}</span></>;
  }
  else if (props.action.kind === "assignment") {
    return <>{props.action.lhs} = <ShowExpr expr={props.action.rhs}/>;</>;
  }
}

export const ShowAST = memo(function ShowASTx(props: {root: ConcreteState | UnstableState}) {
  const description = stateDescription(props.root);
  // const outgoing = props.transitions.get(props.root.uid) || [];

  return <li >{props.root.kind}: {description}
    {props.root.kind !== "pseudo" && props.root.children.length>0 &&
      <ul>
        {props.root.children.map(child => 
          <ShowAST key={child.uid} root={child} />
        )}
      </ul>
    }
  </li>;
});

import BoltIcon from '@mui/icons-material/Bolt';
import { KeyInfoHidden, KeyInfoVisible } from "./TopPanel/KeyInfo";
import { memo, useEffect } from "react";
import { usePersistentState } from "./persistent_state";

export function ShowInputEvents({inputEvents, onRaise, disabled, showKeys}: {inputEvents: EventTrigger[], onRaise: (e: string, p: any) => void, disabled: boolean, showKeys: boolean}) {
  const raiseHandlers = inputEvents.map(({event}) => {
    return () => {
      // @ts-ignore
      const param = document.getElementById(`input-${event}-param`)?.value;
      let paramParsed;
      try {
        if (param) {
          paramParsed = JSON.parse(param); // may throw
        }
      }
      catch (e) {
        alert("invalid json");
        return;
      }
      onRaise(event, paramParsed);
    };
  });
  const onKeyDown = (e: KeyboardEvent) => {
    // don't capture keyboard events when focused on an input element:
    // @ts-ignore
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

    const n = (parseInt(e.key)+9) % 10;
    if (raiseHandlers[n] !== undefined) {
      raiseHandlers[n]();
      e.stopPropagation();
      e.preventDefault();
    }
  }
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [raiseHandlers]);
  // const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  const KeyInfo = KeyInfoVisible; // always show keyboard shortcuts on input events, we can't expect the user to remember them

  const [inputParams, setInputParams] = usePersistentState<{[eventName:string]: string}>("inputParams", {});

  return inputEvents.map(({event, paramName}, i) => {
    const key = event+'/'+paramName;
    const value = inputParams[key] || "";
    const width = Math.max(value.length, (paramName||"").length)*6;
    const shortcut = (i+1)%10;
    const KI = (i < 10) ? KeyInfo : KeyInfoHidden;
    return <div key={key} className="toolbarGroup">
      <KI keyInfo={<kbd>{shortcut}</kbd>} horizontal={true}>
        <button
          className="inputEvent"
          title={`raise this input event`}
          disabled={disabled}
          onClick={raiseHandlers[i]}>
          <BoltIcon fontSize="small"/>
          {event}
        </button>
      </KI>
      {paramName &&
        <><input id={`input-${event}-param`} style={{width, overflow: 'visible'}} placeholder={paramName} value={value} onChange={e => setInputParams(params => ({...params, [key]: e.target.value, }))}/></>
      }
      &nbsp;
    </div>;
  })
}

export function ShowInternalEvents(props: {internalEvents: EventTrigger[]}) {
  return [...props.internalEvents].map(({event, paramName}) => {
      return <><div className="internalEvent">{event}{paramName===undefined?<></>:<>({paramName})</>}</div> </>;
    });
}


export function ShowOutputEvents(props: {outputEvents: Set<string>}) {
  return [...props.outputEvents].map(eventName => {
      return <><div className="outputEvent">{eventName}</div> </>;
    });
}
