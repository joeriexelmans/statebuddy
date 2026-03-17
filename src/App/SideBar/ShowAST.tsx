import BoltIcon from '@mui/icons-material/Bolt';
import { memo, useCallback, useEffect } from "react";
import { useLocalStorage } from "../../hooks/usePersistentState";
import { ConcreteState, stateDescription, Transition, UnstableState } from "../../statecharts/abstract_syntax";
import { Action, EventTrigger, Expression, TransitionLabel } from "../../statecharts/label_ast";
import { KeyInfoHidden, KeyInfoVisible } from "../TopPanel/KeyInfo";
import { useShortcuts } from '@/hooks/useShortcuts';
import { jsonDeepEqual, objectsEqual } from '@/util/util';
import { Tooltip } from '../Components/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
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
import { SimulatorStuff } from '../hooks/useSimulator';
import { WithSetters } from '../makePartialSetter';

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

type ShowInputEventsProps = {
  inputEvents: EventTrigger[], // <-- input events from the abstract syntax
  simulator: SimulatorStuff,
} & WithSetters<{
  declaredInputs: EventTrigger[],
}>;

export const ShowInputEvents = memo(function ShowInputEvents({
  inputEvents,
  simulator,
  declaredInputs,
  setDeclaredInputs,
}: ShowInputEventsProps) {
  const [inputParams, setInputParams] = useLocalStorage<{[eventName:string]: string}>("inputParams", {});

  const raiseOneEvent = useCallback((e: RaisedEvent) => simulator.simulatorCallbacks.onRaise([e]), [simulator.simulatorCallbacks.onRaise]);

  const disabled = (simulator.trace === undefined);

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
      raiseOneEvent({name: event, param});
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
    const width = ((value.length || paramTxt.length) +1.5)+'ch';
    const shortcut = (i+1)%10;
    const KI = (i < 10) ? KeyInfoVisible : KeyInfoHidden; // <-- keyboard shortcuts on first 10 input events
    const disableOurselves = disabled || param && Boolean(highlight.parseError);
    const isDeclared = declaredInputs.some(i => i.event === event);
    const declare = () => setDeclaredInputs(ins => [...ins, {kind: "event", event, param}]);
    const undeclare = () => setDeclaredInputs(ins => ins.filter(i => i.event !== event));
    return <div key={key} style={{pageBreakInside: 'avoid', breakInside: 'avoid-column'}}>
      {isDeclared
        ? <Tooltip tooltip="remove declaration" align='left'><button onClick={undeclare}><RemoveIcon fontSize='small'/></button></Tooltip>
        : <Tooltip tooltip="add declaration" align='left'><button onClick={declare}><AddIcon fontSize='small'/></button></Tooltip>}
      <KI keyInfo={<kbd>{shortcut}</kbd>} horizontal={true}>
        <Tooltip tooltip='input event - click to raise' align='left'>
          <div
            className={styles.inputEvent + ' ' + (!disableOurselves && appStyles.buttonLike)}
            onClick={!disableOurselves && raiseHandlers[i] || undefined}
            style={{
              color: disableOurselves ? 'var(--inactive-fg-color)' : undefined,
              cursor: 'default',
            }}
          >
            &#8600;
            {event}
            {param && <>
              &nbsp;
              {/* syntax highlight overlay */}
              <Overlay background={value &&
                  <pre style={{
                    ...codeStyle,
                    width,
                    borderRadius: 6,
                    height: '2em',
                    backgroundColor: 'var(--textbox-bg-color)',
                  }}>
                    <SyntaxHighlightedText text={value} ranges={ranges}/>
                  </pre>}>
                <input
                  id={`input-${event}-param`}
                  style={{
                    ...codeStyle,
                    width,
                    height: '2em',
                    overflow: 'visible',
                    fontFamily: "'Droid Sans Mono', monospace",
                    borderRadius: 6,
                    color: value && 'transparent',
                    backgroundColor: value && 'transparent',
                    caretColor: 'var(--text-color)',
                  }}
                  placeholder={paramTxt}
                  spellCheck={false}
                  onClick={e => e.stopPropagation()}
                  value={value}
                  onChange={e => {
                    setInputParams(params => ({...params, [key]: e.target.value, }));
                  }}
                />
              </Overlay>
              <div style={{height: 2}}/>
            </>}
          </div>
        </Tooltip>
      </KI>
    </div>;
  });
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


type ShowOutputEventsProps = {
  outputEvents: string[]
} & WithSetters<{
  declaredOutputs: EventTrigger[],
}>;


export function ShowOutputEvents(props: ShowOutputEventsProps) {
  return props.outputEvents.map((eventName) => {
    const isDeclared = props.declaredOutputs.some(o => o.event === eventName);
    const declare = () => props.setDeclaredOutputs(os => [...os, {kind: "event", event: eventName}]);
    const undeclare = () => props.setDeclaredOutputs(os => os.filter(event => event.event !== eventName))
    return <div key={eventName}>
      {isDeclared
        ? <Tooltip tooltip="remove declaration" align='left'><button onClick={undeclare}><RemoveIcon fontSize='small'/></button></Tooltip>
        : <Tooltip tooltip="add declaration" align='left'><button onClick={declare}><AddIcon fontSize='small'/></button></Tooltip>}
      <Tooltip tooltip='output event' align='left'>
        <div className={styles.outputEvent} >
          {/* <ArrowOutwardIcon fontSize="small" style={{verticalAlign: "middle"}}/> */}
          &#8599;
          {eventName}
          {/* {param !== undefined && <>({actionLangValToText(param)})</>} */}
        </div>
      </Tooltip>
    </div>;
  });
}
