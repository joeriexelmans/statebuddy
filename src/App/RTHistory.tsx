import { Dispatch, Ref, SetStateAction } from "react";
import { Statechart, stateDescription } from "../statecharts/abstract_syntax";
import { BigStep, Environment, Mode, RaisedEvent, RT_Event } from "../statecharts/runtime_types";
import { formatTime } from "./util";
import { TimeMode } from "../statecharts/time";
import { TraceState } from "./App";

type RTHistoryProps = {
  trace: TraceState|null,
  setTrace: Dispatch<SetStateAction<TraceState|null>>;
  ast: Statechart,
  setTime: Dispatch<SetStateAction<TimeMode>>,
}

export function RTHistory({trace, setTrace, ast, setTime}: RTHistoryProps) {
  function gotoRt(idx: number, timestamp: number) {
    setTrace(trace => trace && {
      ...trace,
      idx,
    });
    setTime({kind: "paused", simtime: timestamp});
  }

  if (trace === null) {
    return <></>;
  }
  return <div>
    {trace.trace.map((item, i) => {
      if (item.kind === "bigstep") {
        const newStates = item.mode.difference(trace.trace[i-1]?.mode || new Set());
        return <div
          className={"runtimeState" + (i === trace.idx ? " active" : "")}
          onClick={() => gotoRt(i, item.simtime)}>
          <div>
            {formatTime(item.simtime)}
            &emsp;
            <div className="inputEvent">{item.inputEvent || "<init>"}</div>
          </div>
          <ShowMode mode={newStates} statechart={ast}/>
          <ShowEnvironment environment={item.environment}/>
          {item.outputEvents.length>0 && <>^
            {item.outputEvents.map((e:RaisedEvent) => <span className="outputEvent">{e.name}</span>)}
          </>}
        </div>;
      }
      else {
        return <div className="runtimeState runtimeError">
          <div>
            {formatTime(item.simtime)}
            &emsp;
            <div className="inputEvent">{item.inputEvent}</div>
          </div>
          <div>
            {item.error.message}
          </div>
        </div>;
      }
    })}
  </div>;
}


function ShowEnvironment(props: {environment: Environment}) {
  return <div>{
    [...props.environment.entries()]
      .filter(([variable]) => !variable.startsWith('_'))
      .map(([variable,value]) => `${variable}: ${value}`).join(', ')
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
