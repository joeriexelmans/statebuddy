// In this module, React components for rendering DEVS execution traces that contain Statechart execution steps.

import styles from "./Trace.module.css";
import { actionLangValToText } from "@/statecharts/actionlang_prettyprinter";
import { TraceBigStep, TraceFairStep, getRaisedEvents, TraceSmallStep, TraceExit, TraceEnter, TraceAction, TraceInit } from "@/statecharts/microstep_trace_types";
import { RT_Event, RaisedEvent } from "@/statecharts/runtime_types";
import { ReactNode, useState } from "react";
import { Row } from "../Components/Row";
import { Column } from "../Components/Column";
import { EventParam, InitCause, InputCause, TimerCause } from "./Common";
import { DEVSTraceItem } from "@/devs/trace";
import { SC2DEVSState } from "@/devs/sc2devs";
import { RuntimeError } from "@/statecharts/interpreter";

export function SCInitializationTrace({init}: {init: TraceInit}) {
  return <ol style={hiddenListStyle}>
    <li><MyDetails>{open => <>
      <summary>
        <div style={{display: 'inline-block'}}>
          <Row>
            <InitCause/>
          </Row>
        </div>
      </summary>
      <SCEntered entered={init.enteredRoot} />
    </>}</MyDetails></li>
    {init.fairSteps.map(step => <li><SCFairStep fairstep={step} hideOutputEvents={true}/></li>)}
  </ol>;
}

export function SCBigStepTrace({bigstep, hideOutputEvents}: {bigstep: TraceBigStep, hideOutputEvents: boolean}) {
  return <div>
    <ol style={hiddenListStyle}>
      {bigstep.fairSteps.map(step => <li><SCFairStep fairstep={step} hideOutputEvents={hideOutputEvents}/></li>)}
    </ol>
  </div>;
}

const hiddenListStyle = {
  listStyleType: 'none',
  paddingLeft: 10,
}

// Custom details, fixes a bug where a toggle event would also close all parent-<details> nodes.
function MyDetails({children}: {children: (open: boolean) => ReactNode}) {
  const [open, setOpen] = useState(false);
  return <details open={open} onMouseDown={e => e.stopPropagation()} onToggle={e => {setOpen(o => !o); e.stopPropagation()}}>
    {children(open)}
  </details>;
}

function SCFairStep({fairstep, hideOutputEvents}: {fairstep: TraceFairStep, hideOutputEvents: boolean}) {
  return <MyDetails>{open => <>
    <summary>
      <div style={{display: 'inline-block'}}>
        <Row>
          <ShowRTEvent rt_event={fairstep.event}/>
          <Column>
            {!hideOutputEvents && getRaisedEvents(fairstep.fired, "raisedOutput").map(event => <SCRaisedEvent action={{...event, kind: "raisedOutput"}}/>)}
          </Column>
        </Row>
      </div>
    </summary>
    <ol style={hiddenListStyle}>
      {fairstep.fired.map(fired => <li><SCFiredTransition fired={fired}/></li>)}
    </ol>
  </>}</MyDetails>;
}

function ShowRTEvent({rt_event}: {rt_event: RT_Event}) {
  if (rt_event.kind === "event") {
    return <InputCause e={rt_event}/>;
  }
  else {
    return <TimerCause/>;
  }
}

const greyStyle = {color: 'light-dark(#666, #aaa)'};

function SCFiredTransition({fired}: {fired: TraceSmallStep}) {
  return <div>
    <div style={greyStyle}>
      fire {fired.transitionUID}
    </div>
    <ol style={hiddenListStyle}>
      <li><SCExited exited={fired.exited} /></li>
      {fired.transitionActions.map(action => <li><SCExecutedAction action={action}/></li>)}
      <li><SCEntered entered={fired.entered} /></li>
    </ol>
  </div>;
}

function SCExited({exited}: {exited: TraceExit}) {
  return <div>
    <div style={greyStyle}>
      exit <span style={{borderRadius: 7, border: '1px solid black'}}>{exited.stateUID}</span>
    </div>
    <ol style={hiddenListStyle}>
      <li>{exited.childrenExited.map(child => <SCExited exited={child} />)}</li>
      {exited.exitActions.map(action => <li><SCExecutedAction action={action}/></li>)}
    </ol>
  </div>;
}

function SCEntered({entered}: {entered: TraceEnter}) {
  return <div>
    <div style={greyStyle}>
    enter <span style={{borderRadius: 7, border: '1px solid black'}}>{entered.stateUID}</span>
    </div>
    <ol style={hiddenListStyle}>
      {entered.enterActions.map(action => <li><SCExecutedAction action={action}/></li>)}
      <li>{entered.childrenEntered.map(child => <SCEntered entered={child}/>)}</li>
    </ol>
  </div>;
}

function SCExecutedAction({action}: {action: TraceAction}) {
  if (action.kind === "assigned") {
    return <>assign {action.variableName} ← {actionLangValToText(action.value)}</>;
  }
  else {
    return <>raise <SCRaisedEvent action={action}/></>
  }
}

function SCRaisedEvent({action}: {action: RaisedEvent & {kind: "raisedOutput" | "raisedInternal"}}) {
  return <div className={action.kind === "raisedOutput" ?  styles.outputEvent : styles.internalEvent}>
    {action.kind === "raisedOutput" ? '↗' : ''}
    {action.name}<EventParam param={action.param}/>
  </div>;
}

function SCEnvironment({item, prevItem}: {item: DEVSTraceItem<SC2DEVSState, RaisedEvent>, prevItem?: DEVSTraceItem<SC2DEVSState, RaisedEvent>}) {
  const state = item.newState.state;
  const prevState = prevItem?.newState.state;
  if (state instanceof RuntimeError || prevState instanceof RuntimeError) {
    return <></>;
  }
  const prevEnvironment = prevState?.rtconfig?.environment || new Map();
  const environment = state.rtconfig?.environment;
  if (environment) {
    return [...environment.entries()].map(([name, value]) => {
      if ( name.startsWith('(root)._') // <-- hide hidden variables
        // only show changed variables:
        || [...prevEnvironment.entries()||[]].some(([earlierName, earlierValue]) => earlierName === name && earlierValue === value)
      ) {
        return <div key={name}></div>;
      }
      return <div key={name}>
        {name} = {actionLangValToText(value)}
      </div>
    })
  }
  else return <></>;
}
