import styles from "../../Trace/Trace.module.css";

import AddIcon from '@mui/icons-material/Add';
import BoltIcon from '@mui/icons-material/Bolt';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DoubleClickButton } from "@/App/Components/DoubleClickButton";
import { Toolbar } from "@/App/TopPanel/Toolbar";
import { prefixCoupledInputEvent } from "@/App/hooks/useCoupledExecution";
import { DeclaredInput } from "@/App/migrations/v4_types";
import { evalExpr } from "@/languages/actionlang/interpreter";
import { RaisedEvent } from "@/languages/statecharts/interpreter/runtime_types";
import { TransitionLabel } from "@/languages/statecharts/transitionlabel/abstract_syntax";
import { memo, PropsWithChildren, ReactNode, useCallback, useState } from "react";
import { FlatEnvironment } from "../../../languages/statecharts/interpreter/environment";
import { cachedParseLabel } from "../../../languages/statecharts/parser/parser";
import { syntaxHighlight } from "../../../languages/statecharts/transitionlabel/syntax_higlight";
import { WithSetters } from "../../../util/partial_setter";
import { objectsEqual, setsEqual } from "../../../util/util";
import { Overlay } from "../../Components/Overlay";
import { Tooltip } from "../../Components/Tooltip";
import { codeStyle } from "../../Modals/TextDialog";
import { SyntaxHighlightedText } from "../../VisualEditor/SyntaxHiglightedText";
import { useDetectChange2 } from "@/hooks/useDetectChange";

type ShowInputEventsProps = {
  inputEvents: Set<string>, // <-- input events from the abstract syntax
  onRaise: (bag: RaisedEvent[]) => void,
  disabled: boolean,
} & WithSetters<{
  declaredInputs: DeclaredInput[], // <-- 'pinned' inputs (they remain visible in the panel even if they disappear from abstract syntax and plant UI)
}>;

export const InputEventsPanel = memo(function ShowInputEvents({
  inputEvents,
  onRaise,
  disabled,
  declaredInputs,
  setDeclaredInputs,
}: ShowInputEventsProps) {
  // console.log('render input events');
  //   useDetectChange2({
  //   inputEvents,
  //   onRaise,
  //   disabled,
  //   declaredInputs,
  //   setDeclaredInputs,
  // })
  
  const [declareTxt, setDeclareTxt] = useState("");
  
  const raiseOneEvent = useCallback((e: RaisedEvent) => onRaise([e]), [onRaise]);

  const allInputEvents = new Set([...inputEvents, ...declaredInputs.map(e => e.event)]);

  const putDI = (event: string, update: (i?: DeclaredInput) => DeclaredInput) => {
    setDeclaredInputs(ins => {
      const idx = declaredInputs.findIndex(e => e.event === event);
      if (idx === -1) {
        return [...ins, update()];
      }
      else {
        return ins.with(idx, update(declaredInputs[idx]));
      }
    })
  }

  const everything = [...allInputEvents].sort((a,b) => a.localeCompare(b)).map(eventName => {
    const found = declaredInputs.find(e => e.event === eventName);
    if (found) {
      return found;
    }
    else {
      return { event: eventName, paramTxt: "", savedParams: [] };
    }
  });

  const saveParam = (event: string, paramTxt: string) => {
    const value = evalActionLangExpr(paramTxt)
    if (value !== undefined) {
      putDI(event, (di?: DeclaredInput) => {
        if (di) {
          return {...di, savedParams: [...new Set([...(di.savedParams||[]), paramTxt])].sort(), paramTxt: ""};
        }
        else {
          return {event, savedParams: [paramTxt], paramTxt: ""};
        }
      });
    }
  }

  const delParam = (event: string, paramTxt: string) => {
    setDeclaredInputs(ins => ins.map(i => {
      if (i.event === event) {
        return {...i, savedParams: i.savedParams.filter(p => p!==paramTxt)};
      }
      return i;
    }))
  }

  return <>
    <style>{`
      .hideUnlessParentHover {
        visibility: hidden;
      }
      *:hover > .hideUnlessParentHover, .hideUnlessParentHover:hover {
        visibility: unset;
      }
      .delIcon:hover {
        color: var(--error-color);
      }
      .delIcon:active {
        padding-left: 1px;
        padding-top: 1px;
      }
      .transparentButton {
        background: transparent !important;
        border-width: 0 !important;
        height: 26px !important;
        border-radius: 6px !important;
      }
      .transparentButton:hover {
        background: var(--light-accent-color) !important;
      }
    `}</style>
    <div style={{
      overflowX: 'clip',
    }}>
    {everything.map(inputToRender => {
      const occursInAST = inputEvents.has(inputToRender.event);
      const raiseThisEvent = (param?: string) => raiseOneEvent({
        name: prefixCoupledInputEvent("sc", inputToRender.event),
        param: (param === undefined) ? undefined : evalActionLangExpr(param),
      });
      const raiseButton = (
        <Tooltip tooltip={occursInAST
          ? `raise input event\n(without parameter)`
          : `event does not\noccur in Statechart`} align="left">
          <button
            className="transparentButton"
            // style={{
            // }}
            disabled={!occursInAST}
            onClick={() => raiseThisEvent()}
            >
            ↘{inputToRender.event}
            {occursInAST && <span className="hideUnlessParentHover">
              <BoltIcon fontSize="small"/>
            </span>}
          </button>
        </Tooltip>
      );
      return <div key={inputToRender.event} style={{display: 'flex', flexDirection: 'row'}}>
        <div className={styles.inputEvent} style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: 0,
          cursor: occursInAST ? undefined : 'not-allowed',
          }}>
          {/* Button to raise the event without parameter */}
          {occursInAST
            ? raiseButton
            : <TinyDeleteIconHover
                onClick={() => setDeclaredInputs(ins => ins.filter(e => e.event !== inputToRender.event))}
                tooltip="delete declared event"
              >{raiseButton}</TinyDeleteIconHover>}
          {/* One button for each parameter */}
          {(inputToRender.savedParams || []).map(p =>
            <TinyDeleteIconHover
              tooltip={<>forget <pre>{p}</pre></>}
              onClick={() => delParam(inputToRender.event, p)}
              >
              <Tooltip tooltip={occursInAST ? `raise input event\nwith this parameter` : `event does not\noccur in Statechart`}>
                <button
                  className="eventParam transparentButton"
                  style={{
                    fontFamily: 'Roboto Mono, monospace',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  disabled={!occursInAST}
                  onClick={() => raiseThisEvent(p)}
                  >
                  (<PreSyntaxHiglighted txt={p}/>)
                  {/* {p} */}
                  {occursInAST && <span className="hideUnlessParentHover">
                    <BoltIcon fontSize="small"/>
                  </span>}
                </button>
              </Tooltip>
            </TinyDeleteIconHover>
          )}
        </div>
        {/* Input element for adding parameter */}
        <div className="" style={{display: 'flex'}}>
          <Tooltip tooltip={`add event parameter\n<Enter> to add`}>
            <Toolbar>
              <form
                onSubmit={e => {e.preventDefault(); saveParam(inputToRender.event, inputToRender.paramTxt)}}
                style={{display: 'flex'}}
              >
                <Tooltip>
                  <SyntaxHighlightedInput
                    placeholder="add ..."
                    value={inputToRender.paramTxt}
                    setValue={(paramTxt) => {
                      const idx = declaredInputs.findIndex(f => f.event === inputToRender.event);
                      if (idx === -1) {
                        setDeclaredInputs(ins => [...ins, {event: inputToRender.event, savedParams: [], paramTxt}]);
                      }
                      else {
                        const found = declaredInputs[idx];
                        setDeclaredInputs(ins => ins.with(idx, {...found, paramTxt}));
                      }
                    }}
                  />
                </Tooltip>
              </form>
            </Toolbar>
          </Tooltip>
        </div>
      </div>;
    })}
    </div>
    {/* Manually declare event */}
    <Toolbar style={{columnGap: '1em'}}>
      <Toolbar style={{flexGrow: 2}}>
        <form
          onSubmit={e => {e.preventDefault(); setDeclaredInputs(ins => ins.some(e => e.event === declareTxt) ? ins : [...ins, {event: declareTxt, savedParams: [], paramTxt: ""}])}}
          style={{display: 'flex', flexGrow: 1}}
        >
          <Tooltip fullWidth>
          <input
            style={{flexGrow: 1}}
            placeholder="declare input event ..."
            value={declareTxt}
            onChange={e => setDeclareTxt(e.target.value)}
            />
          </Tooltip>
          <Tooltip tooltip="add declaration">
            <button type="submit" disabled={declaredInputs.some(e => e.event === declareTxt)}>
              <AddIcon fontSize="small"/>
            </button>
          </Tooltip>
        </form>
      </Toolbar>
      <Toolbar style={{flexGrow: 1}}>
        <DoubleClickButton tooltip="forget all manually declared inputs, parameters" onClick={() => setDeclaredInputs([])} align="right" fullWidth style={{flexGrow: 1}}>
          <DeleteOutlineIcon fontSize="small"/> reset inputs
        </DoubleClickButton>
      </Toolbar>
    </Toolbar>
  </>;
}, ({inputEvents: prevInputEvents, ...prevRest}, {inputEvents: nextInputEvents, ...nextRest}) => {
  return objectsEqual(prevRest, nextRest)
     && setsEqual(prevInputEvents, nextInputEvents);
});

function SyntaxHighlightedInput({value, setValue, placeholder}: {value: string, setValue: (value: string) => void, placeholder: string}) {
  const width = (Math.max(placeholder.length, value.length) +0.5)+'ch';
  return <Overlay background={value && <PreSyntaxHiglighted txt={value}/>}>
    <input
      style={{
        ...codeStyle,
        width,
        height: '2em',
        overflow: 'visible',
        fontFamily: "'Roboto Mono', monospace",
        borderRadius: 6,
        color: value && 'transparent',
        backgroundColor: value && 'transparent',
        caretColor: 'var(--text-color)',
      }}
      placeholder={placeholder}
      spellCheck={false}
      onClick={e => e.stopPropagation()}
      value={value}
      onChange={e => {
        setValue(e.target.value);
      }}
    />
  </Overlay>;
}

function PreSyntaxHiglighted({txt}: {txt: string}) {
  const highlight = syntaxHighlight(`[${txt}]`);
  const ranges = highlight.ranges.map(r => ({...r, start: r.start-1, end: r.end-1})) || [];
  const width = ((txt.length) +0.5)+'ch';
  return <pre style={{
        ...codeStyle,
        width,
        borderRadius: 6,
        height: '2em',
        borderColor: 'transparent',
      }}>
        <SyntaxHighlightedText text={txt} ranges={ranges}/>
      </pre>;
}

function evalActionLangExpr(exprTxt: string): any {
  try {
    // funny trick to invoke our action language parser: our parser has only one entry point, so to make it parse an expression we must put that expression in a transition label...
    const {guard: exprParsed} = cachedParseLabel(`[${exprTxt}]`) as TransitionLabel; // may throw
    return evalExpr(exprParsed, new FlatEnvironment(), undefined); // may throw
  } catch (e) {
  }
}

function TinyDeleteIconHover({children, tooltip, onClick}: PropsWithChildren<{onClick: ()=>void, tooltip?: string | ReactNode}>) {
  return <div style={{position: 'relative'}}>
    {children}
    <div className="hideUnlessParentHover delIcon" style={{position: 'absolute', zIndex: 10, top:-12,left:-6}}>
        <Tooltip tooltip={tooltip} above align="left">
          <CancelIcon fontSize="inherit" onClick={onClick} style={{cursor: 'default'}}/>
        </Tooltip>
    </div>
  </div>
}
