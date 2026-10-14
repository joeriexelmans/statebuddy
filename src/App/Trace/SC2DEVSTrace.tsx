// In this module, React components for rendering DEVS execution traces that contain Statechart execution steps.

import styles from "./Trace.module.css";
import { actionLangValToText } from "@/statecharts/actionlang_prettyprinter";
import { TraceBigStep, TraceFairStep, TraceSmallStep, TraceExit, TraceEnter, TraceAction, TraceInit } from "@/statecharts/microstep_trace_types";
import { RT_Event, RaisedEvent } from "@/statecharts/runtime_types";
import { PropsWithChildren, ReactNode, useState } from "react";
import { Row } from "../Components/Row";
import { EventParam, InitCause, InputCause, TimerCause } from "./Common";
import { SC2DEVSState } from "@/devs/sc2devs";
import { DEVSTrace } from "@/devs/trace";
import { jsonDeepEqual } from "@/util/util";

export function SCInitializationTrace({init}: {init: TraceInit}) {
  return <TraceList>
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
    {init.fairSteps.map(step => <li><SCFairStep fairstep={step}/></li>)}
  </TraceList>;
}

export function SCBigStepTrace({bigstep}: {bigstep: TraceBigStep}) {
  return <div>
    <TraceList>
      {bigstep.fairSteps.map(step => <li><SCFairStep fairstep={step}/></li>)}
    </TraceList>
  </div>;
}

// Custom details, fixes a bug where a toggle event would also close all parent-<details> nodes.
function MyDetails({children}: {children: (open: boolean) => ReactNode}) {
  const [open, setOpen] = useState(false);
  return <details open={open} onMouseDown={e => e.stopPropagation()} onToggle={e => {setOpen(o => !o); e.stopPropagation()}}>
    {children(open)}
  </details>;
}

function SCFairStep({fairstep}: {fairstep: TraceFairStep}) {
  return <MyDetails>{open => <>
    <summary>
      <div style={{display: 'inline-block'}}>
        <ShowRTEvent rt_event={fairstep.event}/>
      </div>
    </summary>
    <TraceList>
      {fairstep.fired.map(fired => <li><SCFiredTransition fired={fired}/></li>)}
    </TraceList>
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
    <TraceList>
      <li><SCExited exited={fired.exited} /></li>
      {fired.transitionActions.map(action => <li><SCExecutedAction action={action}/></li>)}
      <li><SCEntered entered={fired.entered} /></li>
    </TraceList>
  </div>;
}

function SCExited({exited}: {exited: TraceExit}) {
  return <div>
    <div style={greyStyle}>
      exit <span style={{borderRadius: 7, border: '1px solid black'}}>{exited.stateUID}</span>
    </div>
    <TraceList>
      <li>{exited.childrenExited.map(child => <SCExited exited={child} />)}</li>
      {exited.exitActions.map(action => <li><SCExecutedAction action={action}/></li>)}
    </TraceList>
  </div>;
}

function SCEntered({entered}: {entered: TraceEnter}) {
  return <div>
    <div style={greyStyle}>
    enter <span style={{borderRadius: 7, border: '1px solid black'}}>{entered.stateUID}</span>
    </div>
    <TraceList>
      {entered.enterActions.map(action => <li><SCExecutedAction action={action}/></li>)}
      <li>{entered.childrenEntered.map(child => <SCEntered entered={child}/>)}</li>
    </TraceList>
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

// function SCEnvironment({item, prevItem}: {item: DEVSTraceItem<SC2DEVSState, RaisedEvent>, prevItem?: DEVSTraceItem<SC2DEVSState, RaisedEvent>}) {
//   const state = item.newState.state;
//   const prevState = prevItem?.newState.state;
//   if (state instanceof RuntimeError || prevState instanceof RuntimeError) {
//     return <></>;
//   }
//   const prevEnvironment = prevState?.rtconfig?.environment || new Map();
//   const environment = state.rtconfig?.environment;
//   if (environment) {
//     return [...environment.entries()].map(([name, value]) => {
//       if ( name.startsWith('(root)._') // <-- hide hidden variables
//         // only show changed variables:
//         || [...prevEnvironment.entries()||[]].some(([earlierName, earlierValue]) => earlierName === name && earlierValue === value)
//       ) {
//         return <div key={name}></div>;
//       }
//       return <div key={name}>
//         {name} = {actionLangValToText(value)}
//       </div>
//     })
//   }
//   else return <></>;
// }

const hiddenListStyle = {
  listStyleType: 'none',
  paddingLeft: 10,
}

function TraceList({children}: PropsWithChildren<{}>) {
  return <ol style={hiddenListStyle}>
    {children}
  </ol>;
}

// An 'output step' is when a Statechart performs an intTransition immediately after handling an input event (extTransition), with the purpose of only outputting some events.
// If a Statechart makes an output step, we render that step slightly differently (we hide the timer icon), so it becomes a bit clearer that in the world of Statecharts, the output step was caused by (or even stronger: is part of) the previous step.
// This heuristic (hopefully) works for our Statechart and also for plants that are implemented as a Statechart.
export function isOutputStep(trace: DEVSTrace<SC2DEVSState, RaisedEvent>) {
  const itemState = trace.at(-1)!;
  const prevItemState = trace.at(-2);
  const prevState = prevItemState?.newState;
  const newState = itemState.newState;
  const prevScheduledOutputs = prevState?.outputQueue; // <-- could also be undefined if newState does not have property 'outputQueue'...
  const curOutputs = itemState.kind === "intTransition" && itemState.outputEvents;
  const isOutputStep = jsonDeepEqual(prevScheduledOutputs, curOutputs) // the scheduled outputs of previous SC step are equal to the current outputs
    && prevItemState?.simtime === itemState.simtime // <-- time didn't change
    && newState.outputQueue?.length === 0; // <-- our current output queue is empty (because we outputted all of our outputs)
  return isOutputStep;
}

