import { RuntimeError } from "@/statecharts/interpreter";
import { DEVSComponent } from "./devs";
import { RaisedEvent } from "@/statecharts/runtime_types";

type Common<T> = {
  simtime: number,
  newState: T,
}

export type DEVSTraceItemInit<T> = {
  kind: "init",
} & Common<T>

export type DEVSTraceItemExtTransition<T> = {
  kind: "extTransition",
  bagOfInputs: RaisedEvent[],
} & Common<T>

export type DEVSTraceItemIntTransition<T> = {
  kind: "intTransition",
  outputEvents: RaisedEvent[], // <-- empty if `result.ok` is false
} & Common<T>

export type DEVSTraceItem<T> = DEVSTraceItemInit<T> | DEVSTraceItemExtTransition<T> | DEVSTraceItemIntTransition<T>;

export type DEVSTrace<T> = DEVSTraceItem<T>[]; // <-- always at least one item

// Transforms a DEVS component with state-type T into a DEVS component with state-type DEVSTract<T>.
// The behavior remains exactly the same, except that runtime errors are caught and appended to the end of the trace.
export function makeTracedDEVS<T>(devs: DEVSComponent<T>): DEVSComponent<DEVSTrace<T>> {
  return {
    initial: () => {
      // initial is trace with one item:
      return [
        {
          kind: "init",
          simtime: 0,
          newState: devs.initial(),
        }
      ];
    },
    timeAdvance: (trace: DEVSTrace<T>) => {
      const lastState = trace.at(-1)!.newState;
      return devs.timeAdvance(lastState);
    },
    intTransition: (trace: DEVSTrace<T>) => {
      const lastState = trace.at(-1)!.newState;
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
          } as DEVSTraceItem<T>,
        ]
      ];
    },
    extTransition: (simtime: number, trace: DEVSTrace<T>, bagOfInputs: RaisedEvent[]) => {
      const lastState = trace.at(-1)!.newState;
      const newState = devs.extTransition(simtime, lastState, bagOfInputs);
      return [
        ...trace,
        {
          kind: "extTransition",
          simtime,
          bagOfInputs,
          newState,
        } as DEVSTraceItem<T>,
      ];
    },
    inputs: devs.inputs,
    outputs: devs.outputs,
  }
}
