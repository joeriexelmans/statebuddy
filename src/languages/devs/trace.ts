import { DEVSComponent } from "./devs";

type Common<T> = {
  simtime: number,
  newState: T,
  numExtTransitions: number, // <-- optimization: we count the number of external transitions that have happened up till the current trace item. We do this because, when storing traces (on disk or in app URL), we only store a sequence of timed input events, because this is enough to restore the full trace. It helps if we know which index in the "full trace" (including internal transitions) corresponds to which index in the "stored trace" (excluding internal transitions) because this makes it possible to "slice" both kinds of traces (for instance, to "insert" an event in the middle).
}

export type DEVSTraceItemInit<T> = {
  kind: "init",
} & Common<T>

export type DEVSTraceItemExtTransition<T,E> = {
  kind: "extTransition",
  bagOfInputs: E[],
} & Common<T>

export type DEVSTraceItemIntTransition<T,E> = {
  kind: "intTransition",
  outputEvents: E[], // <-- empty if `result.ok` is false
} & Common<T>

export type DEVSTraceItem<T,E> = DEVSTraceItemInit<T> | DEVSTraceItemExtTransition<T,E> | DEVSTraceItemIntTransition<T,E>;

export type DEVSTrace<T,E> = DEVSTraceItem<T,E>[]; // <-- always at least one item

// Transforms a DEVS component with state-type T into a DEVS component with state-type DEVSTract<T>.
// The behavior remains exactly the same, except that runtime errors are caught and appended to the end of the trace.
export function makeTracedDEVS<T,E>(devs: DEVSComponent<T,E>): DEVSComponent<DEVSTrace<T,E>,E> {
  return {
    initial: () => {
      // initial is trace with one item:
      return [
        {
          kind: "init",
          simtime: 0,
          newState: devs.initial(),
          numExtTransitions: 0,
        }
      ];
    },
    timeAdvance: (trace: DEVSTrace<T,E>) => {
      const lastState = trace.at(-1)!.newState;
      return devs.timeAdvance(lastState);
    },
    intTransition: (trace: DEVSTrace<T,E>) => {
      const lastItem = trace.at(-1)!;
      const lastState = lastItem.newState;
      const simtime = devs.timeAdvance(lastState);
      const [outputEvents, newState] = devs.intTransition(lastState);
      return [
        outputEvents,
        [
          ...trace,
          {
            kind: "intTransition",
            simtime,
            newState,
            outputEvents,
            numExtTransitions: lastItem.numExtTransitions, // <-- no change
          } as DEVSTraceItem<T,E>,
        ]
      ];
    },
    extTransition: (simtime: number, trace: DEVSTrace<T,E>, bagOfInputs: E[]) => {
      const lastItem = trace.at(-1)!;
      const lastState = lastItem.newState;
      const newState = devs.extTransition(simtime, lastState, bagOfInputs);
      return [
        ...trace,
        {
          kind: "extTransition",
          simtime,
          bagOfInputs,
          newState,
          numExtTransitions: lastItem.numExtTransitions + 1,
        } as DEVSTraceItem<T,E>,
      ];
    },
    inputs: devs.inputs,
    outputs: devs.outputs,
  }
}
