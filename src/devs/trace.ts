import { DEVSComponent } from "./devs";
import { RaisedEvent } from "@/statecharts/runtime_types";

export type DEVSTraceItemInit<T> = {
  kind: "init",
  simtime: 0,
  newState: T,
}

export type DEVSTraceItemExtTransition<T> = {
  kind: "extTransition",
  simtime: number,
  bagOfInputs: RaisedEvent[],
  newState: T,
}

export type DEVSTraceItemIntTransition<T> = {
  kind: "intTransition",
  simtime: number,
  outputEvents: RaisedEvent[], // <-- empty if `result.ok` is false
  newState: T,
}

export type DEVSTraceItem<T> = DEVSTraceItemInit<T> | DEVSTraceItemExtTransition<T> | DEVSTraceItemIntTransition<T>;

export type DEVSTrace<T> = [DEVSTraceItem<T>, ...DEVSTraceItem<T>[]]; // <-- always at least one item

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

// function expectNonFaultyTrace<T>(trace: DEVSTrace<T>): T {
//   const lastItem = trace.at(-1)!;
//   if (lastItem.result.ok) {
//     const lastState = lastItem.result.newState;
//     return lastState;
//   }
//   else {
//     throw new Error("trace contains an error");
//   }
// }

// function catchRuntimeError<T>(possiblyFailingCallback: () => T): DEVSStepResult<T> {
//   try {
//     const newState = possiblyFailingCallback();
//     return {
//       ok: true,
//       newState,
//     };
//   }
//   catch (error) {
//     if (error instanceof RuntimeError) {
//       return {
//         ok: false,
//         error,
//       };
//     }
//     else {
//       // all other errors are just passed through
//       throw error;
//     }
//   }
// }
