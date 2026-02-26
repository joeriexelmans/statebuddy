import { DEVSComponent } from "./devs";
import { DEVSTrace, extTransition, initTrace, intTransition, timeAdvance } from "./trace";

type ExtTransitionTraceItem = {
  simtime: number;
  eventName: string;
  param?: any;
}

// returns a trace containing only the extTransitions.
// this is the minimum of information we need to replay a trace.
export function saveExtTransitions<T>(trace: DEVSTrace<T>): ExtTransitionTraceItem[] {
  return trace.reduce((prev, cur) => {
    if (cur.kind === "extTransition") {
      return [...prev, {
        simtime: cur.simtime,
        eventName: cur.eventName,
        param: cur.param,
      } as ExtTransitionTraceItem];
    }
    return prev;
  }, [] as ExtTransitionTraceItem[])
}

// given a serialized trace (containing only extTransitions), replay the extTransitions so that we get our original trace back :)
export function restoreTrace<T>(extTransitions: ExtTransitionTraceItem[], devs: DEVSComponent<T>): DEVSTrace<T> {
  let trace = initTrace(devs) as DEVSTrace<T>;
  while (extTransitions.length > 1) {
    let nextExtTransition;
    [nextExtTransition, ...extTransitions] = extTransitions; // pop
    // now, we'll fire all intTransitions that must fire before the next extTransition
    while (true) {
      const nextTimeout = timeAdvance(devs, trace);
      if (nextTimeout > nextExtTransition.simtime) {
        break;
      }
      trace = intTransition(devs, trace);
    }
    // now we fire the extTransition
    trace = extTransition(devs, trace, {
      name: nextExtTransition.eventName,
      param: nextExtTransition.param,
    }, nextExtTransition.simtime);
  }
  // done !!!!
  return trace;
}
