import { Statechart } from "@/statecharts/abstract_syntax";
import { RuntimeError } from "@/statecharts/interpreter";
import { BigStep, RaisedEvent, Timers } from "@/statecharts/runtime_types";
import { Conns, coupledExecution, statechartExecution } from "@/statecharts/timed_reactive";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plant } from "../Plant/Plant";
import { getSimTime, getWallClkDelay, TimeMode } from "@/statecharts/time";
import { UniversalPlantState } from "../plants";

type CoupledState = {
  sc: BigStep,
  plant: BigStep,
};

export type TraceItemError = {
  cause: BigStepCause, // event name, <init> or <timer>
  simtime: number,
  error: RuntimeError,
}

export type BigStepCause = {
  kind: "init",
  simtime: 0,
} | {
  kind: "input",
  simtime: number,
  eventName: string,
  param?: any,
} | {
  kind: "timer",
  simtime: number,
};

export type TraceItem =
  { kind: "error" } & TraceItemError
| { kind: "bigstep", simtime: number, cause: BigStepCause, state: CoupledState, outputEvents: RaisedEvent[] };

export type TraceState = {
  trace: [TraceItem, ...TraceItem[]], // non-empty
  idx: number,
};

const ignoreRaise = (inputEvent: string, param: any) => {};


export function useSimulator(ast: Statechart|null, plant: Plant<any, UniversalPlantState>, plantConns: Conns, onStep: () => void) {
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  const [trace, setTrace] = useState<TraceState|null>(null);
  const currentTraceItem = trace && trace.trace[trace.idx];

  // coupled execution
  const cE = useMemo(() => ast && coupledExecution({
    sc: statechartExecution(ast),
    plant: plant.execution,
  }, {
    ...plantConns,
    ...Object.fromEntries(ast.inputEvents.map(({event}) => ["debug."+event, ['sc',event] as [string,string]])),
  }), [ast, plant, plantConns]);

  const onInit = useCallback(() => {
    if (cE === null) return;
    const metadata = {simtime: 0, cause: {kind: "init" as const, simtime: 0 as const}};
    try {
      const [outputEvents, state] = cE.initial(); // may throw if initialing the statechart results in a RuntimeError
      setTrace({
        trace: [{kind: "bigstep", ...metadata, state, outputEvents}],
        idx: 0,
      });
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        setTrace({
          trace: [{kind: "error", ...metadata, error}],
          idx: 0,
        });
      }
      else {
        throw error; // probably a bug in the interpreter
      }
    }
    setTime(time => {
      if (time.kind === "paused") {
        return {...time, simtime: 0};
      }
      else {
        return {...time, since: {simtime: 0, wallclktime: performance.now()}};
      }
    });
    onStep();
  }, [cE, onStep]);

  const onClear = useCallback(() => {
    setTrace(null);
    setTime({kind: "paused", simtime: 0});
  }, [setTrace, setTime]);

  const catchRuntimeError = useCallback((simtime: number, cause: BigStepCause, computeNewState: () => [RaisedEvent[], CoupledState]) => {
    const metadata = {simtime, cause}
    try {
      const [outputEvents, state] = computeNewState(); // may throw RuntimeError
      return {kind: "bigstep" as const, ...metadata, state, outputEvents};
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        return {kind: "error" as const, ...metadata, error};
      }
      else {
        throw error;
      }
    }
  }, []);

  const appendNewConfig = useCallback((simtime: number, cause: BigStepCause, computeNewState: () => [RaisedEvent[], CoupledState]) => {
    const newItem = catchRuntimeError(simtime, cause, computeNewState);
    if (newItem.kind === "error") {
      // also pause the simulation, for dramatic effect:
      setTime({kind: "paused", simtime});
    }
    // @ts-ignore
    setTrace(trace => ({
      trace: [
        ...trace!.trace.slice(0, trace!.idx+1), // remove everything after current item
        newItem,
      ],
      // idx: 0,
      idx: trace!.idx+1,
    }));
    onStep();
  }, [onStep, setTrace, setTime]);

  // raise input event, producing a new runtime configuration (or a runtime error)
  const onRaise = useMemo(() => {
    if (cE === null || currentTraceItem === null) {
      return ignoreRaise; // this speeds up rendering of components that depend on onRaise if the model is being edited while there is no ongoing trace
    }
    else return (inputEvent: string, param: any) => {
      if (currentTraceItem.kind === "bigstep") {
        const simtime = getSimTime(time, Math.round(performance.now()));
        appendNewConfig(simtime, {kind: "input", simtime, eventName: inputEvent, param}, () => {
          return cE.extTransition(simtime, currentTraceItem.state, {kind: "event", name: inputEvent, param});
        });
      }
    };
  }, [cE, currentTraceItem, time, appendNewConfig]);

  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    // console.log('time effect:', time, currentTraceItem);
    let timeout: NodeJS.Timeout | undefined;
    if (currentTraceItem !== null && cE !== null) {
      if (currentTraceItem.kind === "bigstep") {
        const nextTimeout = cE?.timeAdvance(currentTraceItem.state);

        const raiseTimeEvent = () => {
          appendNewConfig(nextTimeout, {kind: "timer", simtime: nextTimeout}, () => {
            return cE.intTransition(currentTraceItem.state);
          });
        }

        if (time.kind === "realtime") {
          const wallclkDelay = getWallClkDelay(time, nextTimeout, Math.round(performance.now()));
          if (wallclkDelay !== Infinity) {
            timeout = setTimeout(raiseTimeEvent, wallclkDelay);
          }
        }
        else if (time.kind === "paused") {
          if (nextTimeout <= time.simtime) {
            raiseTimeEvent();
          }
        }
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [time, currentTraceItem]); // <-- todo: is this really efficient?

  const onBack = useCallback(() => {
    if (trace !== null && trace.idx > 0) {
      setTime(() => {
        if (trace !== null) {
          return {
            kind: "paused",
            simtime: trace.trace[trace.idx-1].simtime,
          }
        }
        return { kind: "paused", simtime: 0 };
      });
      setTrace({
        ...trace,
        idx: trace.idx-1,
      });
    }
  }, [trace, trace?.idx, setTime, setTrace]);

  const onReplayTrace = useCallback((causes: BigStepCause[]) => {
    if (cE) {
      function run_until(simtime: number) {
        while (true) {
          const nextTimeout = cE!.timeAdvance(lastState);
          if (nextTimeout > simtime) {
            break;
          }
          const item = catchRuntimeError(nextTimeout, {kind: "timer", simtime: nextTimeout}, () => cE!.intTransition(lastState));
          newTrace.push(item);
          if (item.kind === "error") {
            return;
          }
          else {
            lastState = item.state;
            lastSimtime = item.simtime;
          }
        }
      }
      const [outputEvents, coupledState] = cE.initial();
      const newTrace = [{kind: "bigstep", simtime: 0, state: coupledState, outputEvents, cause: {kind: "init"} as BigStepCause} as TraceItem] as [TraceItem, ...TraceItem[]];
      let lastState = coupledState;
      let lastSimtime = 0;
      for (const cause of causes) {
        if (cause.kind === "input") {
          run_until(cause.simtime); // <-- just make sure we haven't missed any timers elapsing
          const item = catchRuntimeError(cause.simtime, cause,
            () => cE.extTransition(cause.simtime,
              // @ts-ignore
              newTrace.at(-1)!.state,
              {kind: "event", name: cause.eventName, param: cause.param}));
          newTrace.push(item);
          if (item.kind === "error") {
            break;
          }
          else {
            lastState = item.state;
            lastSimtime = item.simtime;
          }
        }
        else if (cause.kind === "timer") {
          run_until(cause.simtime);
        }
      }
      setTrace({trace: newTrace, idx: newTrace.length-1});
      setTime({kind: "paused", simtime: lastSimtime});
    }
  }, [setTrace, setTime, cE]);

  // timestamp of next timed transition, in simulated time
  const timers: Timers = currentTraceItem?.kind === "bigstep" && currentTraceItem.state.sc.timers || [];
  const nextTimedTransition = timers[0];
  const nextWakeup = nextTimedTransition?.[0] || Infinity;

  return {trace, setTrace, plant, onInit, onClear, onBack, onRaise, onReplayTrace, time, setTime, nextWakeup};
}
