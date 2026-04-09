import appStyles from "../../App.module.css";
import styles from "./Trace.module.css";

import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PushPinIcon from '@mui/icons-material/PushPin';

import { memo, useCallback } from "react";
import { useLocalStorage } from "../../../hooks/usePersistentState";
import { useShortcuts } from "../../../hooks/useShortcuts";
import { evalExpr } from "../../../statecharts/actionlang_interpreter";
import { actionLangLhsToText } from "../../../statecharts/actionlang_prettyprinter";
import { FlatEnvironment } from "../../../statecharts/environment";
import { EventTrigger, TransitionLabel } from "../../../statecharts/label_ast";
import { cachedParseLabel } from "../../../statecharts/parser";
import { RaisedEvent } from "../../../statecharts/runtime_types";
import { syntaxHighlight } from "../../../statecharts/syntax_higlight";
import { objectsEqual, jsonDeepEqual } from "../../../util/util";
import { Overlay } from "../../Components/Overlay";
import { Tooltip } from "../../Components/Tooltip";
import { WithSetters } from "../../makePartialSetter";
import { codeStyle } from "../../Modals/TextDialog";
import { KeyInfoVisible, KeyInfoHidden } from "../../TopPanel/KeyInfo";
import { SyntaxHighlightedText } from "../../VisualEditor/SyntaxHiglightedText";
import { TwoStateButton } from "@/App/Components/TwoStateButton";

type ShowInputEventsProps = {
  inputEvents: EventTrigger[], // <-- input events from the abstract syntax
  onRaise: (bag: RaisedEvent[]) => void,
  disabled: boolean,
} & WithSetters<{
  declaredInputs: EventTrigger[],
}>;

export const InputEventsPanel = memo(function ShowInputEvents({
  inputEvents,
  onRaise,
  disabled,
  declaredInputs,
  setDeclaredInputs,
}: ShowInputEventsProps) {
  const [inputParams, setInputParams] = useLocalStorage<{[eventName:string]: string}>("inputParams", {});

  const raiseOneEvent = useCallback((e: RaisedEvent) => onRaise([e]), [onRaise]);

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
        ? <Tooltip tooltip={<>unpin input event<br/>(don't keep input event if it doesn't occur in the Statechart model)</>} align='left'>
            <TwoStateButton onClick={undeclare} active><PushPinIcon fontSize='small'/></TwoStateButton>
          </Tooltip>
        : <Tooltip tooltip={<>pin input event<br/>(keep the input event even if it doesn't occur in the Statechart model)</>} align='left'>
            <TwoStateButton onClick={declare} active={false}><PushPinIcon fontSize='small'/></TwoStateButton>
          </Tooltip>}
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
