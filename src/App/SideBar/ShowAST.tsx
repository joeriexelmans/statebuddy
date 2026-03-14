import BoltIcon from '@mui/icons-material/Bolt';
import { memo, useEffect } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { ConcreteState, stateDescription, Transition, UnstableState } from "../../statecharts/abstract_syntax";
import { Action, EventTrigger, Expression, TransitionLabel } from "../../statecharts/label_ast";
import { KeyInfoHidden, KeyInfoVisible } from "../TopPanel/KeyInfo";
import { useShortcuts } from '@/hooks/useShortcuts';
import { arraysEqual, jsonDeepEqual, objectsEqual } from '@/util/util';
import { Tooltip } from '../Components/Tooltip';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import styles from "./Trace.module.css";
import appStyles from "../App.module.css";
import { RaisedEvent } from '@/statecharts/runtime_types';
import { cachedParseLabel } from '@/statecharts/parser';
import { evalExpr } from '@/statecharts/actionlang_interpreter';
import { FlatEnvironment } from '@/statecharts/environment';
import { actionLangLhsToText, actionLangValToText } from '@/statecharts/actionlang_prettyprinter';
import { syntaxHighlight } from '@/statecharts/syntax_higlight';
import { Overlay } from '../Components/Overlay';
import { SyntaxHighlightedText } from '../VisualEditor/SyntaxHiglightedText';
import { codeStyle } from '../Modals/TextDialog';
import { useDetectChange } from '@/hooks/useDetectChange';

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


export const ShowInputEvents = memo(function ShowInputEvents({inputEvents, onRaise, disabled}: {inputEvents: EventTrigger[], onRaise: (eventName: string, param: any) => void, disabled: boolean}) {
  const [inputParams, setInputParams] = usePersistentState<{[eventName:string]: string}>("inputParams", {});

  useDetectChange(inputParams, 'inputParams');

  const raiseHandlers = inputEvents.map(({event}) => {
    return () => {
      // @ts-ignore
      const exprText = document.getElementById(`input-${event}-param`)?.value;
      let param;
      try {
        if (exprText) {
          // funny trick to invoke our action language parser: our parser has only one entry point, so to make it parse an expression we must put that expression in a transition label...
          const {guard: exprParsed} = cachedParseLabel(`after 1s [${exprText}]`) as TransitionLabel; // may throw
          param = evalExpr(exprParsed, new FlatEnvironment(), []); // may throw
        }
      }
      catch (e) {
        alert("failed to parse expression - see developer tools for details");
        console.warn(e);
        return;
      }
      onRaise(event, param);
    };
  });

  // less painful and more readable than figuring out the equivalent of range(n) in JS:
  // (btw, useShortcuts must always be called with an array of the same size)
  useShortcuts([0,1,2,3,4,5,6,7,8,9].map(i => {
    const n = (i+1) % 10; // key '1' should be mapped to first event (index 0)
    return {
      keys: [n.toString()],
      action: raiseHandlers[i] || (() => {}),
    };
  }));


  return inputEvents.map(({event, param}, i) => {
    const paramTxt = param && actionLangLhsToText(param) || "";
    const key = event+'/'+paramTxt;
    const value = inputParams[key] || "";
    const highlight = syntaxHighlight(`[${value}]`);
    const ranges = highlight.ranges.map(r => ({...r, start: r.start-1, end: r.end-1})) || [];
    const width = ((value.length || paramTxt.length) +2)+'ch';
    const shortcut = (i+1)%10;
    const KI = (i < 10) ? KeyInfoVisible : KeyInfoHidden; // <-- keyboard shortcuts on first 10 input events
    return <div key={key} style={{pageBreakInside: 'avoid', breakInside: 'avoid-column'}}>
      <KI keyInfo={<kbd>{shortcut}</kbd>} horizontal={true}>
        <Tooltip tooltip='input event - click to raise' align='left'>
          <button
            className={styles.inputEvent}
            disabled={disabled || param && Boolean(highlight.parseError)}
            onClick={raiseHandlers[i]}>
            &#8600;
            {event}
            {param && <>
              &nbsp;
              <Overlay background={value && <pre style={{...codeStyle, width, borderRadius: 6, backgroundColor: 'var(--background-color)'}}><SyntaxHighlightedText text={value} ranges={ranges}/></pre>}>
                <input
                  id={`input-${event}-param`}
                  style={{
                    ...codeStyle,
                    width,
                    overflow: 'visible',
                    fontFamily: "'Droid Sans Mono', monospace",
                    borderRadius: 6,
                    color: value && 'transparent',
                    backgroundColor: value && 'transparent',
                    caretColor: 'var(--text-color)',
                  }}
                  placeholder={paramTxt}
                  value={value}
                  spellCheck={false}
                  
                  // onClick={e => {e.stopPropagation();}} // <-- do not escalate click on parameter text field to the parent button
                  onChange={e => {
                    console.log('onChange');
                    setInputParams(params => ({...params, [key]: e.target.value, }));
                  }}
                />
              </Overlay>
            </>}
          </button>
        </Tooltip>
      </KI>
    </div>;
  })
}, ({inputEvents: prevInputEvents, ...prevRest}, {inputEvents: nextInputEvents, ...nextRest}) => {
  return objectsEqual(prevRest, nextRest)
     && jsonDeepEqual(prevInputEvents, nextInputEvents);
});

export function ShowInternalEvents(props: {internalEvents: EventTrigger[]}) {
  return [...props.internalEvents].map(({event, param}) => {
    return <div key={event}>
      <Tooltip tooltip='internal event' align='left'>
        <div className={styles.internalEvent}>
          {event}
          {/* {param !== undefined && <>({param})</>} */}
        </div>
      </Tooltip>
    </div>;
  });
}


export function ShowOutputEvents(props: {outputEvents: RaisedEvent[]}) {
  return props.outputEvents.map(({name, param}) => {
      return <div key={name}>
        <Tooltip tooltip='output event' align='left'>
          <div className={styles.outputEvent} >
            {/* <ArrowOutwardIcon fontSize="small" style={{verticalAlign: "middle"}}/> */}
            &#8599;
            {name}
            {param !== undefined && <>({actionLangValToText(param)})</>}
          </div>
        </Tooltip>
      </div>;
    });
}
