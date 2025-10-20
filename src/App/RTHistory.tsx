import { Dispatch, Ref, SetStateAction } from "react";
import { Statechart, stateDescription } from "../statecharts/abstract_syntax";
import { BigStep, Environment, Mode, RaisedEvent } from "../statecharts/runtime_types";
import { formatTime } from "./util";
import { TimeMode } from "../statecharts/time";

type RTHistoryProps = {
  rt: BigStep[],
  rtIdx: number | undefined,
  ast: Statechart,
  setRTIdx: Dispatch<SetStateAction<number|undefined>>,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  refRightSideBar: Ref<HTMLDivElement>,
}

export function RTHistory({rt, rtIdx, ast, setRTIdx, setTime, refRightSideBar}: RTHistoryProps) {
  function gotoRt(idx: number, timestamp: number) {
    setRTIdx(idx);
    setTime({kind: "paused", simtime: timestamp});
  }

  return <div>
    {rt.map((r, idx) => <>
    <hr/>
    <div className={"runtimeState"+(idx===rtIdx?" active":"")} onClick={() => gotoRt(idx, r.simtime)}>
      <div>
        {formatTime(r.simtime)}
        &emsp;
        <div className="inputEvent">{r.inputEvent || "<init>"}</div>
      </div>
      <ShowMode mode={r.mode.difference(rt[idx-1]?.mode || new Set())} statechart={ast}/>
      <ShowEnvironment environment={r.environment}/>
      {r.outputEvents.length>0 && <>^
        {r.outputEvents.map((e:RaisedEvent) => <span className="outputEvent">{e.name}</span>)}
      </>}
    </div></>)}
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
    sc.uid2State.get(uid)?.children?.length === 0
  ));
}
