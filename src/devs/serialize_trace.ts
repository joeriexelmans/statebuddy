import { DEVSComponent } from "./devs";
import { DEVSTrace, extTransition, initTrace, intTransition, timeAdvance } from "./trace";

type ExtTransitionTraceItem = {
  simtime: number;
  eventName: string;
  param?: any;
}

// A trace of only extTransitions.
// This is the minimum of information necessary to replay a trace on a DEVS component.
export type ExtTransitionTrace = {
  // sequence of timed extTransitions:
  trace: ExtTransitionTraceItem[],

  // we also store last point in simulated time, because there may still be intTransitions that happened after the last extTransition:
  lastSimTime: number,
};

// returns a trace containing only the extTransitions.
// this is the minimum of information we need to replay a trace.
export function saveExtTransitions<T>(trace: DEVSTrace<T>, lastSimTime: number): ExtTransitionTrace {
  const reducedTrace = trace.reduce((prev, cur) => {
    if (cur.kind === "extTransition") {
      return [...prev, {
        simtime: cur.simtime,
        eventName: cur.eventName,
        param: cur.param,
      } as ExtTransitionTraceItem];
    }
    return prev;
  }, [] as ExtTransitionTraceItem[]);
  return {
    trace: reducedTrace,
    lastSimTime,
  }
}

function runUntil<T>(devs: DEVSComponent<T>, trace: DEVSTrace<T>, until: number) {
  while (true) {
    const nextTimeout = timeAdvance(devs, trace);
    if (nextTimeout > until) {
      break;
    }
    trace = intTransition(devs, trace);
  }
  return trace;
}

// given a serialized trace (containing only extTransitions), replay the extTransitions so that we get our original trace back :)
export function restoreTrace<T>(extTrace: ExtTransitionTrace, devs: DEVSComponent<T>): DEVSTrace<T> {
  let trace = initTrace(devs) as DEVSTrace<T>;
  let remaining = extTrace.trace;
  while (extTrace.trace.length > 1) {
    let nextExtTransition;
    [nextExtTransition, ...remaining] = remaining; // pop
    // now, we'll fire all intTransitions that must fire before the next extTransition
    trace = runUntil(devs, trace, nextExtTransition.simtime);
    // now we fire the extTransition
    trace = extTransition(devs, trace, {
      kind: "event",
      name: nextExtTransition.eventName,
      param: nextExtTransition.param
    }, nextExtTransition.simtime);
  }
  // finally run a bit more because there may still be intTransitions that need to fire
  trace = runUntil(devs, trace, extTrace.lastSimTime);
  // done !!!!
  return trace;
}
