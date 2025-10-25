import { ConcreteState, UnstableState, stateDescription, Transition } from "../statecharts/abstract_syntax";
import { Action, EventTrigger, Expression } from "../statecharts/label_ast";
import { RT_Statechart } from "../statecharts/runtime_types";

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

  // return <details open={true} className={"stateTree" + (props.highlightActive.has(props.root.uid) ? " active" : "")}>
  //   <summary>{props.root.kind}: {description}</summary>

  //   {/* {props.root.kind !== "pseudo" && props.root.entryActions.length>0 &&
  //       props.root.entryActions.map(action =>
  //         <div>&emsp;entry / <ShowAction action={action}/></div>
  //       )
  //   }
  //   {props.root.kind !== "pseudo" && props.root.exitActions.length>0 &&
  //       props.root.exitActions.map(action =>
  //         <div>&emsp;exit / <ShowAction action={action}/></div>
  //       )
  //   } */}

  //   {props.root.kind !== "pseudo" && props.root.children.length>0 &&
  //         props.root.children.map(child => 
  //           <ShowAST key={child.uid} root={child} transitions={props.transitions} rt={props.rt} highlightActive={props.highlightActive} />
  //         )
  //   }
  //   {/* {outgoing.length>0 &&
  //       outgoing.map(transition => <>&emsp;<ShowTransition transition={transition}/><br/></>)
  //   } */}
  // </details>;
});

import BoltIcon from '@mui/icons-material/Bolt';
import { KeyInfoHidden, KeyInfoVisible } from "./TopPanel/KeyInfo";
import { memo, useEffect } from "react";

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
  return inputEvents.map(({event, paramName}, i) => {
    const shortcut = (i+1)%10;
    const KI = (i <= 10) ? KeyInfo : KeyInfoHidden;
    return <div key={event+'/'+paramName} className="toolbarGroup">
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
        <><input id={`input-${event}-param`} style={{width: 20}} placeholder={paramName}/></>
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
