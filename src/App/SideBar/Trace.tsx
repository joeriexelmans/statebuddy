import { Dispatch, memo, SetStateAction, useCallback } from "react";
import { Statechart, stateDescription, Transition } from "../../statecharts/abstract_syntax";
import { RaisedEvent, RT_Event } from "../../statecharts/runtime_types";
import { arraysEqual, formatTime, jsonDeepEqual } from "../../util/util";
import { TimeMode, timeTravel } from "../../statecharts/time";
import { Environment } from "@/statecharts/environment";

import styles from "./Trace.module.css";

import BoltIcon from '@mui/icons-material/Bolt';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import FlareIcon from '@mui/icons-material/Flare';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import { Status } from "./Status";
import { Tooltip } from "../Components/Tooltip";
import { CoupledState, StateBuddyTraceState } from "../hooks/useSimulator";
import { WithSetters } from "../makePartialSetter";
import { DEVSTraceItem } from "@/devs/trace";
import { ShowOutputEvents } from "./ShowAST";

type PropertyTrace = [number, boolean][];
type PropertyStatus = "pending" | "satisfied" | "violated";

function lookupPropertyStatus(simtime: number, propertyTrace: PropertyTrace, startAt=0): [number, boolean | undefined] {
  let i = startAt;
  while (i >= 0 && i < propertyTrace.length) {
    const [timestamp] = propertyTrace[i];
    if (timestamp === simtime) {
      // exact match
      break;
    }
    else if (timestamp > simtime) {
      i--;
      // too far
      break;
    }
    // continue...
    i++;
  }
  i = Math.min(i, propertyTrace.length-1);
  return [i, propertyTrace[i] && propertyTrace[i][1]];
}


type TraceProps = WithSetters<{
  trace: StateBuddyTraceState,
  showMicroSteps: boolean,
}> & {
  // clicking on an item in the trace will jump to it so we need to set the time to that point.
  setTime: Dispatch<SetStateAction<TimeMode>>,


  ast: Statechart,

  // // just some switches
  // showPlantTrace: boolean,

  // // result of checking a property is a trace of booleans which we display in the trace
  // propertyTrace: PropertyTrace | null,
}

export function Trace({trace, setTrace, setTime, ast, showMicroSteps, setShowMicroSteps}: TraceProps) {
  return <div>
    {trace.trace.map((item, i) => {
      const prevItem = trace.trace[i-1];
      const prevScheduledOutputs = prevItem?.result.ok && prevItem.result.newState.sc.outputQueue;
      const curOutputs = item.kind === "intTransition" && item.outputEvents;
      const isOutputStep = curOutputs && jsonDeepEqual(prevScheduledOutputs, curOutputs);
      return <div
          className={styles.traceItem
                    + ' ' + ((trace.idx === i) ? styles.active : "")}
          onMouseDown={e => {
            if (e.button === 0) {
              if (trace.idx === i) {
                setShowMicroSteps(x => !x);
              }
              else {
                setTrace(trace => ({trace: trace.trace, idx: i}));
                setTime(_ => ({kind: "paused", simtime: item.simtime}));
              }
            }
          }}
        >
        <div style={{display: 'flex', gap: '1em'}}>
          <Tooltip tooltip="timestamp" align="left">
            <div style={{width: 50, textAlign: 'right'}}>
              {item.simtime !== prevItem?.simtime && formatTime(item.simtime)}
            </div>
          </Tooltip>
          <TraceItem item={item} isOutputStep={isOutputStep}/>
          {item.result.ok && !isOutputStep && <>
            <ShowFiredTransitions
              firedTransitions={[...ast.transitions.values().flatMap(t =>
                // @ts-ignore
                t.filter(t => item.result.newState?.sc.bigstep.firedTransitions.includes(t.uid)))]}/>
          </>}
        </div>
        {item.result.ok && showMicroSteps && trace.idx === i &&
          <MicroSteps msgs={isOutputStep ? ["(step was only made to produce output events)"] : item.result.newState.sc.bigstep.microsteps}/>}
      </div>;
    })}
  </div>;
}

function TraceItem({item, isOutputStep}: {item: DEVSTraceItem<CoupledState>, isOutputStep: boolean}) {
  if (item.kind === "init") {
    return <div className={styles.inputEvent}>
      <Tooltip tooltip="execution initialized" align="left">
        <FlareIcon fontSize="small"/>
      </Tooltip>
    </div>;
  }
  else if (item.kind === "intTransition") {
    return <>
      <div className={styles.inputEvent}>
        {isOutputStep
          &&  <Tooltip tooltip="internal transition (DEVS) only to produce output events, caused by previous step" align="left">
                <SubdirectoryArrowRightIcon fontSize="small"/>
              </Tooltip>
          ||  <Tooltip tooltip="timer elapse" align="left">
                <AccessAlarmIcon fontSize="small"/>
              </Tooltip>}
        {/* todo: show which timer elapsed? */}
      </div>
      <ShowOutputEvents outputEvents={item.outputEvents}/>
    </>;
  }
  else if (item.kind === "extTransition") {
    return <div className={styles.inputEvent}>
      <Tooltip tooltip="input event" align="left">
        <BoltIcon fontSize="small"/>
        {item.eventName}
        <EventParam param={item.param}/>
      </Tooltip>
    </div>;
  }
}

// export function Trace({trace, setTrace, ast, setTime, showPlantTrace, propertyTrace, showMicroSteps}: TraceProps) {
//   const onMouseDown = useCallback((idx: number, timestamp: number) => {
//     setTrace(trace => trace && {
//       ...trace,
//       idx,
//     });
//     setTime(time => timeTravel(time, timestamp, performance.now()));
//   }, [setTrace, setTime]);

//   if (trace === null) {
//     return <></>;
//   }
//   let j = 0;
//   return trace.trace.map((item, i) => {
//     const prevItem = trace.trace[i-1];
//     // @ts-ignore
//     const isPlantStep = item.state?.sc === prevItem?.state?.sc;
//     if (!showPlantTrace && isPlantStep) {
//       return <></>
//     }
//     let propertyStatus: PropertyStatus = "pending";
//     if (propertyTrace !== null) {
//       let satisfied;
//       [j, satisfied] = lookupPropertyStatus(item.simtime, propertyTrace, j);
//       // console.log(item.simtime, j, propertyTrace[j]);
//       if (satisfied !== null && satisfied !== undefined) {
//         propertyStatus = (satisfied ? "satisfied" : "violated");
//       }
//     }
//     return <RTHistoryItem
//       ast={ast}
//       idx={i}
//       item={item}
//       prevItem={prevItem}
//       isPlantStep={isPlantStep}
//       active={i === trace.idx}
//       onMouseDown={onMouseDown}
//       propertyStatus={propertyStatus}
//       microsteps={i === trace.idx && showMicroSteps}/>;
//   });
// }

// function RTCause(props: {cause?: RT_Event}) {
//   if (props.cause === undefined) {
//     return <></>;
//   }
//   if (props.cause.kind === "timer") {
//     return <div className={styles.inputEvent}>
//       <AccessAlarmIcon fontSize="small"/>
//     </div>;
//   }
//   else if (props.cause.kind === "event") {
//     return <div className={styles.inputEvent}>
//       {props.cause.name}
//       <RTEventParam param={props.cause.param}/>
//     </div>;
//   }
//   // console.log(props.cause);
//   throw new Error("unreachable");
// }

function EventParam(props: {param?: any}) {
  return <>{props.param !== undefined && <>({JSON.stringify(props.param)})</>}</>;
}

// export const RTHistoryItem = memo(function RTHistoryItem({ast, idx, item, prevItem, isPlantStep, active, onMouseDown, propertyStatus, microsteps}: {idx: number, ast: Statechart, item: TraceItem, prevItem?: TraceItem, isPlantStep: boolean, active: boolean, onMouseDown: (idx: number, timestamp: number) => void, propertyStatus: PropertyStatus, microsteps: boolean}) {
//   if (item.kind === "bigstep") {
//     const outputEvents = isPlantStep ? item.state.plant.outputEvents : item.state.sc.outputEvents;
//     return <div
//       className={styles.traceItem + ' ' + (active ? styles.active : "") + ' ' + (isPlantStep ? styles.plantStep : "")}
//       onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
//       <div>
//         <Status status={propertyStatus}/>
//         &emsp;
//         <Tooltip tooltip="simulated time">{formatTime(item.simtime)}</Tooltip>
//         &emsp;
//         <RTCause cause={isPlantStep ? item.state.plant.inputEvent : item.state.sc.inputEvent}/>
//         {outputEvents.length>0 &&
//           <div style={{display: 'inline-block'}}>&nbsp;&#x2192;&nbsp;
//           {outputEvents.map((e:RaisedEvent) => <span className={styles.outputEvent}>{e.name}<RTEventParam param={e.param}/></span>)}
//           </div>}
//       </div>
//       {/* {!isPlantStep &&
//         <ShowFiredTransitions firedTransitions={
//           [...ast.transitions.values().flatMap(t => t.filter(t => item.state.sc.firedTransitions.includes(t.uid)))]}/>
//       } */}
//       <ShowEnvironment environment={item.state.sc.environment}/>
//       {microsteps && <MicroSteps msgs={item.msgs} />}
//     </div>;
//   }
//   else {
//     // error item
//     return <div
//       className={styles.traceItem
//          + ' ' + styles.runtimeError
//          + ' ' + (active ? styles.active : "")}
//       onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
//       <div>
//         {formatTime(item.simtime)}
//         &emsp;
//         <div className={styles.inputEvent}><ShowCause cause={item.cause}/></div>
//       </div>
//       <div>
//         {item.error.message}
//       </div>
//       {microsteps && <MicroSteps msgs={item.msgs} />}
//     </div>;
//   }
// });

function MicroSteps({msgs}: {msgs: string[]}) {
  return <div style={{
    paddingLeft: 4,
    whiteSpace: 'preserve',
    backgroundColor: 'var(--statusbar-bg-color)', // <-- just make it stand out a bit
    borderRadius: '4px', // <-- make it look pretty
    marginTop: 4,
  }}>{msgs.map(msg => <div>{msg}</div>)}</div>;
}

function ShowFiredTransitions({firedTransitions}: {firedTransitions: Transition[]}) {
  return <>
    {firedTransitions.map((t, i) => <><ShowTransition key={i} transition={t}/></>)}
  </>
}

function ShowTransition({transition}: {transition: Transition}) {
  return <span>
    <span className="activeState">{stateDescription(transition.src)}</span>
    &#x2192;
    <span className="activeState">{stateDescription(transition.tgt)}</span>
    &emsp;
  </span>
}

// function ShowCause(props: {cause: BigStepCause}) {
//   if (props.cause.kind === "init") {
//     return <></>;
//   }
//   else if (props.cause.kind === "timer") {
//     return <AccessAlarmIcon fontSize="small"/>;
//   }
//   else {
//     return <span>{props.cause.eventName}<RTEventParam param={props.cause.param}/></span>;
//   }
// }

// function ShowEnvironment(props: {environment: Environment}) {
//   return <div>{
//     [...props.environment.entries()]
//       .filter(([variable]) => !variable.startsWith('_'))
//       .map(([variable,value]) => `${variable.split('.').at(-1)}=${JSON.stringify(value)}`).join(', ')
//   }</div>;
// }
