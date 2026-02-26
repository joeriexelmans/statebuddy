import { RuntimeError } from "@/statecharts/interpreter";
import { DEVSComponent } from "./devs";
import { NormalEvent, RaisedEvent } from "@/statecharts/runtime_types";


type DEVSStepResult<T> = {
  ok: true,
  newState: T,
} | {
  ok: false,
  error: RuntimeError,
};

export type DEVSTraceItem<T> =
(
  {
    kind: "init",
    simtime: 0, // simulated time
  } | {
    kind: "extTransition",
    simtime: number,
    eventName: string,
    param?: any,
  } | {
    kind: "intTransition",
    simtime: number,
    outputEvents: RaisedEvent[], // <-- empty if `result.ok` is false
  }
) & {
  result: DEVSStepResult<T>,
};

export type DEVSTrace<T> = [DEVSTraceItem<T>, ...DEVSTraceItem<T>[]];

function expectNonFaultyTrace<T>(trace: DEVSTrace<T>): T {
  const lastItem = trace.at(-1)!;
  if (lastItem.result.ok) {
    const lastState = lastItem.result.newState;
    return lastState;
  }
  else {
    throw new Error("trace contains an error");
  }
}

function catchRuntimeError<T>(possiblyFailingCallback: () => T): DEVSStepResult<T> {
  try {
    const newState = possiblyFailingCallback();
    return {
      ok: true,
      newState,
    };
  }
  catch (error) {
    if (error instanceof RuntimeError) {
      return {
        ok: false,
        error,
      };
    }
    else {
      // all other errors are just passed through
      throw error;
    }
  }
}

// below are a bunch of wrappers for executing DEVS functions and appending the result to a DEVSTrace:

// Initialize DEVS component, resulting in trace with one item.
export function initTrace<T>(devs: DEVSComponent<T>): [DEVSTraceItem<T>] {
  const result = catchRuntimeError(() => devs.initial());
  return [
    {
      kind: "init",
      simtime: 0,
      result,
    }
  ];
}

// Call timeAdvance on last item in trace
export function timeAdvance<T>(devs: DEVSComponent<T>, trace: DEVSTrace<T>): number {
  const lastState = expectNonFaultyTrace(trace);
  return devs.timeAdvance(lastState);
}

// Perform intTransition on last item in trace, growing the trace with 1 item.
export function intTransition<T>(devs: DEVSComponent<T>, trace: DEVSTrace<T>): DEVSTrace<T> {
  const lastState = expectNonFaultyTrace(trace);
  const simtime = devs.timeAdvance(lastState);
  let outputEvents: RaisedEvent[] = [];
  const result = catchRuntimeError(() => {
    let newState;
    // overwrite our outputEvents variable above:
    [outputEvents, newState] = devs.intTransition(lastState);
    return newState;
  });
  return [
    ...trace,
    {
      kind: "intTransition",
      simtime,
      result,
      outputEvents,
    } as DEVSTraceItem<T>,
  ];
}

// Perform extTransition on last item in trace, growing the trace with 1 item.
export function extTransition<T>(devs: DEVSComponent<T>, trace: DEVSTrace<T>, e: RaisedEvent, simtime: number): DEVSTrace<T> {
  const lastState = expectNonFaultyTrace(trace);
  const result = catchRuntimeError(() => devs.extTransition(simtime, lastState, e));
  console.log('extTransition..', trace);
  return [
    ...trace,
    {
      kind: "extTransition",
      simtime,
      eventName: e.name,
      param: e.param,
      result,
    } as DEVSTraceItem<T>,
  ];
}
