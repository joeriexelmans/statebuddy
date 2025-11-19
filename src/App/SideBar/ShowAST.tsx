import BoltIcon from '@mui/icons-material/Bolt';
import { memo, useEffect } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { ConcreteState, stateDescription, Transition, UnstableState } from "../../statecharts/abstract_syntax";
import { Action, EventTrigger, Expression } from "../../statecharts/label_ast";
import { KeyInfoHidden, KeyInfoVisible } from "../TopPanel/KeyInfo";
import { useShortcuts } from '@/hooks/useShortcuts';
import { arraysEqual, jsonDeepEqual } from '@/util/util';
import { Tooltip } from '../Components/Tooltip';

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


export const ShowInputEvents = memo(function ShowInputEvents({inputEvents, onRaise, disabled}: {inputEvents: EventTrigger[], onRaise: (e: string, p: any) => void, disabled: boolean}) {
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

  // less painful and more readable than figuring out the equivalent of range(n) in JS:
  // (btw, useShortcuts must always be called with an array of the same size)
  useShortcuts([0,1,2,3,4,5,6,7,8,9].map(i => {
    const n = (i+1) % 10;
    return {
      keys: [n.toString()],
      action: raiseHandlers[n] || (() => {}),
    };
  }));

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
        <Tooltip tooltip='click to raise'>
          <button
            className="inputEvent"
            disabled={disabled}
            onClick={raiseHandlers[i]}>
            <BoltIcon fontSize="small"/>
            {event}
          </button>
        </Tooltip>
      </KI>
      {paramName &&
        <><input id={`input-${event}-param`} style={{width, overflow: 'visible'}} placeholder={paramName} value={value} onChange={e => setInputParams(params => ({...params, [key]: e.target.value, }))}/></>
      }
      &nbsp;
    </div>;
  })
}, (prevProps, nextProps) => {
  return prevProps.onRaise === nextProps.onRaise
     && prevProps.disabled === nextProps.disabled
     && jsonDeepEqual(prevProps.inputEvents, nextProps.inputEvents);
});

export function ShowInternalEvents(props: {internalEvents: EventTrigger[]}) {
  return [...props.internalEvents].map(({event, paramName}) => {
      return <div className="internalEvent" key={event}>{event}{paramName===undefined?<></>:<>({paramName})</>}</div>;
    });
}


export function ShowOutputEvents(props: {outputEvents: Set<string>}) {
  return [...props.outputEvents].map(eventName => {
      return <div className="outputEvent" key={eventName}>{eventName}</div>;
    });
}
