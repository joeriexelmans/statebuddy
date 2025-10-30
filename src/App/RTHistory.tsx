import { Dispatch, memo, SetStateAction, useCallback } from "react";
import { Statechart, stateDescription } from "../statecharts/abstract_syntax";
import { Mode, RaisedEvent, RT_Event } from "../statecharts/runtime_types";
import { formatTime } from "../util/util";
import { TimeMode, timeTravel } from "../statecharts/time";
import { TraceItem, TraceState } from "./App";
import { Environment } from "@/statecharts/environment";

type RTHistoryProps = {
  trace: TraceState|null,
  setTrace: Dispatch<SetStateAction<TraceState|null>>;
  ast: Statechart,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  showPlantTrace: boolean,
}

export function RTHistory({trace, setTrace, ast, setTime, showPlantTrace}: RTHistoryProps) {
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
  return trace.trace.map((item, i) => {
    const prevItem = trace.trace[i-1];
    // @ts-ignore
    const isPlantStep = item.state?.sc === prevItem?.state?.sc;
    if (!showPlantTrace && isPlantStep) {
      return <></>
    }
    return <RTHistoryItem ast={ast} idx={i} item={item} prevItem={prevItem} isPlantStep={isPlantStep} active={i === trace.idx} onMouseDown={onMouseDown}/>;
  });
}

function RTCause(props: {cause?: RT_Event}) {
  if (props.cause === undefined) {
    return <>{"<init>"}</>;
  }
  if (props.cause.kind === "timer") {
    return <>{"<timer>"}</>;
  }
  else if (props.cause.kind === "input") {
    return <>{props.cause.name}<RTEventParam param={props.cause.param}/></>
  }
  console.log(props.cause);
  throw new Error("unreachable");
}

function RTEventParam(props: {param?: any}) {
  return <>{props.param !== undefined && <>({JSON.stringify(props.param)})</>}</>;
}

export const RTHistoryItem = memo(function RTHistoryItem({ast, idx, item, prevItem, isPlantStep, active, onMouseDown}: {idx: number, ast: Statechart, item: TraceItem, prevItem?: TraceItem, isPlantStep: boolean, active: boolean, onMouseDown: (idx: number, timestamp: number) => void}) {
  if (item.kind === "bigstep") {
    // @ts-ignore
    const newStates = item.state.sc.mode.difference(prevItem?.state.sc.mode || new Set());
    return <div
      className={"runtimeState" + (active ? " active" : "") + (isPlantStep ? " plantStep" : "")}
      onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
      <div>
        {formatTime(item.simtime)}
        &emsp;
        <div className="inputEvent"><RTCause cause={isPlantStep ? item.state.plant.inputEvent : item.state.sc.inputEvent}/></div>
      </div>
      <ShowMode mode={newStates} statechart={ast}/>
      <ShowEnvironment environment={item.state.sc.environment}/>
      {item.state.sc.outputEvents.length>0 && <>^
        {item.state.sc.outputEvents.map((e:RaisedEvent) => <span className="outputEvent">{e.name}<RTEventParam param={e.param}/></span>)}
      </>}
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
        <div className="inputEvent">{item.cause}</div>
      </div>
      <div>
        {item.error.message}
      </div>
    </div>;
  }
});


function ShowEnvironment(props: {environment: Environment}) {
  return <div>{
    [...props.environment.entries()]
      .filter(([variable]) => !variable.startsWith('_'))
      .map(([variable,value]) => `${variable.split('.').at(-1)}: ${JSON.stringify(value)}`).join(', ')
  }</div>;
}

function ShowMode(props: {mode: Mode, statechart: Statechart}) {
  const activeLeafs = getActiveLeafs(props.mode, props.statechart);
  return <div>{[...activeLeafs].map(uid =>
    <span className="activeState">{stateDescription(props.statechart.uid2State.get(uid)!)}</span>)}</div>;
}

function getActiveLeafs(mode: Mode, sc: Statechart) {
  return new Set([...mode].filter(uid =>
    // @ts-ignore
    sc.uid2State.get(uid)?.children?.length === 0
  ));
}
