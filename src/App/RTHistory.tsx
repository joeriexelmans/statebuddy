import { Dispatch, SetStateAction } from "react";
import { Statechart, stateDescription } from "../statecharts/abstract_syntax";
import { BigStep, Environment, Mode } from "../statecharts/runtime_types";
import { formatTime } from "./util";
import { TimeMode } from "../statecharts/time";

type RTHistoryProps = {
  rt: BigStep[],
  rtIdx: number | undefined,
  ast: Statechart,
  setRTIdx: Dispatch<SetStateAction<number|undefined>>,
  setTime: Dispatch<SetStateAction<TimeMode>>,
}

export function RTHistory({rt, rtIdx, ast, setRTIdx, setTime}: RTHistoryProps) {
  function gotoRt(idx: number, timestamp: number) {
    setRTIdx(idx);
    setTime({kind: "paused", simtime: timestamp});
  }

  return rt.map((rt, idx) => <>
    <div className={"runtimeState"+(idx===rtIdx?" active":"")} onClick={() => gotoRt(idx, rt.simtime)}>
      <div>({formatTime(rt.simtime)}, {rt.inputEvent || "<init>"})</div>
      <ShowMode mode={rt.mode} statechart={ast}/>
      <ShowEnvironment environment={rt.environment}/>
      {rt.outputEvents.length>0 && <div>
        {rt.outputEvents.map((e:string) => '^'+e).join(', ')}
    </div>}
  </div></>);
}


function ShowEnvironment(props: {environment: Environment}) {
  return <div>{[...props.environment.entries()]
    .filter(([variable]) => !variable.startsWith('_'))
    .map(([variable,value]) =>
    `${variable}: ${value}`
  ).join(', ')}</div>;
}

function ShowMode(props: {mode: Mode, statechart: Statechart}) {
  const activeLeafs = getActiveLeafs(props.mode, props.statechart);
  return <div>mode: {[...activeLeafs].map(uid =>
    stateDescription(props.statechart.uid2State.get(uid)!)).join(", ")}</div>;
}

function getActiveLeafs(mode: Mode, sc: Statechart) {
  const toDelete = [];
  for (const stateA of mode) {
    for (const stateB of mode) {
      if (sc.uid2State.get(stateA)!.parent === sc.uid2State.get(stateB)) {
        toDelete.push(stateB);
      }
    }
  }
  return mode.difference(new Set(toDelete));
}
