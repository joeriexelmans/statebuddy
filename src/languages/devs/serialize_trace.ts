import { DEVSComponent } from "./devs";
import { DEVSTrace } from "./trace";
import { ExtTransitionTrace, ExtTransitionTraceItem } from "@/App/migrations/v1_types";

// returns a trace containing only the extTransitions.
// this is the minimum of information we need to replay a trace.
export function saveExtTransitions<T>(trace: DEVSTrace<T>, lastSimTime: number): ExtTransitionTrace {
  const reducedTrace = trace.reduce((acc, cur) => {
    if (cur.kind === "extTransition") {
      return [...acc, {
        simtime: cur.simtime,
        bagOfInputs: cur.bagOfInputs,
      } as ExtTransitionTraceItem];
    }
    return acc;
  }, [] as ExtTransitionTraceItem[]);
  return {
    trace: reducedTrace,
    lastSimTime,
  }
}

function runUntil<T>(tracedDEVS: DEVSComponent<DEVSTrace<T>>, trace: DEVSTrace<T>, until: number) {
  while (true) {
    const nextTimeout = tracedDEVS.timeAdvance(trace);
    if (nextTimeout > until) {
      break;
    }
    let outputs;
    [outputs, trace] = tracedDEVS.intTransition(trace);
  }
  return trace;
}

// given a serialized trace (containing only extTransitions), replay the extTransitions so that we get our original trace back :)
export function restoreTrace<T>(
  extTrace: ExtTransitionTrace,
  tracedDEVS: DEVSComponent<DEVSTrace<T>>,
): DEVSTrace<T> {
  let trace = tracedDEVS.initial();
  let remaining = extTrace.trace;
  while (remaining.length > 0) {
    let nextInput;
    [nextInput, ...remaining] = remaining; // pop
    // now, we'll fire all intTransitions that must fire before the next extTransition
    trace = runUntil(tracedDEVS, trace, nextInput.simtime);
    // now we fire the extTransition
    trace = tracedDEVS.extTransition(nextInput.simtime, trace, nextInput.bagOfInputs);
  }
  // finally run a bit more because there may still be intTransitions that need to fire
  trace = runUntil(tracedDEVS, trace, extTrace.lastSimTime);
  // done !!!!
  return trace;
}
