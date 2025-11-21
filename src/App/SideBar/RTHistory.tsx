import { Dispatch, memo, SetStateAction, useCallback } from "react";
import { Statechart, stateDescription, Transition } from "../../statecharts/abstract_syntax";
import { Mode, RaisedEvent, RT_Event } from "../../statecharts/runtime_types";
import { formatTime } from "../../util/util";
import { TimeMode, timeTravel } from "../../statecharts/time";
import { Environment } from "@/statecharts/environment";
import { BigStepCause, TraceItem, TraceState } from "../hooks/useSimulator";

import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';

type PropertyTrace = [number, boolean][];

type RTHistoryProps = {
  trace: TraceState|null,
  setTrace: Dispatch<SetStateAction<TraceState|null>>;
  ast: Statechart,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  showPlantTrace: boolean,
  propertyTrace: PropertyTrace | null,
}

type PropertyStatus = "unknown" | "satisfied" | "violated";

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

export function RTHistory({trace, setTrace, ast, setTime, showPlantTrace, propertyTrace}: RTHistoryProps) {
  const onMouseDown = useCallback((idx: number, timestamp: number) => {
    setTrace(trace => trace && {
      ...trace,
      idx,
    });
    setTime(time => timeTravel(time, timestamp, performance.now()));
  }, [setTrace, setTime]);

  if (trace === null) {
    return <></>;
  }
  let j = 0;
  return trace.trace.map((item, i) => {
    const prevItem = trace.trace[i-1];
    // @ts-ignore
    const isPlantStep = item.state?.sc === prevItem?.state?.sc;
    if (!showPlantTrace && isPlantStep) {
      return <></>
    }
    let propertyStatus: PropertyStatus = "unknown";
    if (propertyTrace !== null) {
      let satisfied;
      [j, satisfied] = lookupPropertyStatus(item.simtime, propertyTrace, j);
      // console.log(item.simtime, j, propertyTrace[j]);
      if (satisfied !== null && satisfied !== undefined) {
        propertyStatus = (satisfied ? "satisfied" : "violated");
      }
    }
    return <RTHistoryItem ast={ast} idx={i} item={item} prevItem={prevItem} isPlantStep={isPlantStep} active={i === trace.idx} onMouseDown={onMouseDown} propertyStatus={propertyStatus} />;
  });
}

function RTCause(props: {cause?: RT_Event}) {
  if (props.cause === undefined) {
    return <></>;
  }
  if (props.cause.kind === "timer") {
    return <div className="inputEvent">
      <AccessAlarmIcon fontSize="small"/>
    </div>;
  }
  else if (props.cause.kind === "event") {
    return <div className="inputEvent">
      {props.cause.name}
      <RTEventParam param={props.cause.param}/>
    </div>;
  }
  // console.log(props.cause);
  throw new Error("unreachable");
}

function RTEventParam(props: {param?: any}) {
  return <>{props.param !== undefined && <>({JSON.stringify(props.param)})</>}</>;
}

export const RTHistoryItem = memo(function RTHistoryItem({ast, idx, item, prevItem, isPlantStep, active, onMouseDown, propertyStatus}: {idx: number, ast: Statechart, item: TraceItem, prevItem?: TraceItem, isPlantStep: boolean, active: boolean, onMouseDown: (idx: number, timestamp: number) => void, propertyStatus: PropertyStatus}) {
  if (item.kind === "bigstep") {
    const outputEvents = isPlantStep ? item.state.plant.outputEvents : item.state.sc.outputEvents;
    // @ts-ignore
    // const newStates = item.state.sc.mode.difference(prevItem?.state.sc.mode || new Set());
    return <div
      className={"runtimeState" + (active ? " active" : "") + (isPlantStep ? " plantStep" : "")}
      onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
      <div>
        <div className={"status " + propertyStatus}/>
        &emsp;
        {formatTime(item.simtime)}
        &emsp;
        <RTCause cause={isPlantStep ? item.state.plant.inputEvent : item.state.sc.inputEvent}/>
        {outputEvents.length>0 &&
          <>&nbsp;&#x2192;&nbsp;
          {outputEvents.map((e:RaisedEvent) => <span className="outputEvent">{e.name}<RTEventParam param={e.param}/></span>)}
          </>}
      </div>
      {!isPlantStep &&
        <ShowFiredTransitions firedTransitions={
          [...ast.transitions.values().flatMap(t => t.filter(t => item.state.sc.firedTransitions.includes(t.uid)))]}/>
      }
      {/* <ShowMode mode={newStates} statechart={ast}/> */}
      <ShowEnvironment environment={item.state.sc.environment}/>
    </div>;
  }
  else {
    // error item
    return <div
      className={"runtimeState runtimeError" + (active ? " active" : "")}
      onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
      <div>
        {formatTime(item.simtime)}
        &emsp;
        <div className="inputEvent"><ShowCause cause={item.cause}/></div>
      </div>
      <div>
        {item.error.message}
      </div>
    </div>;
  }
});

function ShowFiredTransitions({firedTransitions}: {firedTransitions: Transition[]}) {
  return <>
    {firedTransitions.map((t, i) => <ShowTransition key={i} transition={t}/>)}
  </>
}

function ShowTransition({transition}: {transition: Transition}) {
  return <>
    <span className="activeState">{stateDescription(transition.src)}</span>
    &#x2192;
    <span className="activeState">{stateDescription(transition.tgt)}</span>
    &emsp;
  </>
}

function ShowCause(props: {cause: BigStepCause}) {
  if (props.cause.kind === "init") {
    return <></>;
  }
  else if (props.cause.kind === "timer") {
    return <AccessAlarmIcon fontSize="small"/>;
  }
  else {
    return <span>{props.cause.eventName}<RTEventParam param={props.cause.param}/></span>;
  }
}

function ShowEnvironment(props: {environment: Environment}) {
  return <div>{
    [...props.environment.entries()]
      .filter(([variable]) => !variable.startsWith('_'))
      .map(([variable,value]) => `${variable.split('.').at(-1)}=${JSON.stringify(value)}`).join(', ')
  }</div>;
}
