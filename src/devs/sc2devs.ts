// DEVS adapter for Statecharts

import { Statechart } from "@/statecharts/abstract_syntax";
import { TraceBigStep, TraceFairStep, getOutputEventsFromBigStep, getOutputEventsFromInit, getRaisedEvents, TraceInit, RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "./devs";
import { initialize, makeBigStep, RuntimeError } from "@/statecharts/interpreter";
import { newTracer } from "@/statecharts/tracer";

export type SC2DEVSNonError =
    TraceInit & {kind: "init"}
  | TraceBigStep & {kind: "bigstep"};

// When we wrap a Statechart in an atomic DEVS, this is the type of its DEVS-state:
export type SC2DEVSState = {
  // The most up-to-date execution state.
  // If there is an error, then this DEVS component is in a special "error" state, where its intTransition is +Inf, and its extTransition doesn't do anything anymore.
  state: SC2DEVSNonError
       | RuntimeError,

  // a Statechart can output events when it responds to an input event, but this is not allowed in an extTransition in DEVS. Therefore, we store all these output events in our internal state, such that we can output them in a follow-up intTransition:
  outputQueue: RaisedEvent[],
};


// Wraps a Statechart in a DEVS component
export function sc2DEVS(ast: Statechart): DEVSComponent<SC2DEVSState> {
  return {
    initial: () => {
      return catchRuntimeError(
        () => initialize(ast),
        init => ({
          state: {kind: "init", ...init},
          outputQueue: getOutputEventsFromInit(init),
        }),
        error => ({
          state: error,
          outputQueue: [],
        }) as SC2DEVSState,
      );
    },
    timeAdvance: (c: SC2DEVSState) => {
      if (c.state instanceof RuntimeError) {
        // the statechart crashed, cannot advance any further :(
        return Infinity;
      }
      if (c.outputQueue.length > 0) {
        return c.state.kind === "init" ? 0 : c.state.simtime; // immediately (= current simulated time)
      }
      if (c.state.rtconfig.timers[0]) {
        return c.state.rtconfig.timers[0][0];
      }
      return Infinity;
    },
    intTransition: (c: SC2DEVSState) => {
      if (c.state instanceof RuntimeError) {
        throw new Error("cannot make intTransition - the Statechart has crashed");
      }
      if (c.outputQueue.length > 0) {
        // Perform an 'output step' -- output our output events and do nothing else:
        return [c.outputQueue, {
          state: {fairSteps: [], rtconfig: c.state.rtconfig, simtime: c.state.simtime},
          outputQueue: [],
        }];
      }
      if (c.state.rtconfig.timers.length === 0) {
        throw new Error("cannot make intTransition - timeAdvance is infinity");
      }
      // pop timer:
      const [[when, timerElapseEvent], ...remainingTimers] = c.state.rtconfig.timers;
      // handle timer event:
      const newC = {...c.state, timers: remainingTimers, simtime: when};
      // let outputEvents = [] as RaisedEvent[];
      return catchRuntimeError(
        () => {
          const bigstep = makeBigStep(newC.rtconfig, newC.simtime, timerElapseEvent, ast);
          return bigstep;
        },
        bigstep => [
          getOutputEventsFromBigStep(bigstep),
          {
            state: {kind: "bigstep", ...bigstep},
            outputQueue: [],
          } as SC2DEVSState,
        ] as const,
        error => [
          [] as RaisedEvent[],
          {
            state: error,
            outputQueue: [],
          } as SC2DEVSState,
        ] as const,
      )
    },
    // Small mismatch here: A Statechart will only handle one input event at a time, but DEVS supports a bag of inputs. We just handle all the inputs sequentially (one RTC step per input event). So an extTransition can actually consist of more than one RTC step.
    extTransition: (simtime: number, c: SC2DEVSState, bagOfInputs: RaisedEvent[]) => {
      console.log({bagOfInputs});
      
      if (c.state instanceof RuntimeError) {
         // ignore
        return {
          state: new RuntimeError(`ignoring input - see earlier error`, []),
          microsteps: [],
          outputQueue: [],
        };
      }
      // execute one big step for each input event:
      let rtconfig = c.state.rtconfig;
      let fairSteps = [] as TraceFairStep[];
      let outputs = c.outputQueue;
      return catchRuntimeError(
        () => {
          for (const e of bagOfInputs) {
            const bigstep = makeBigStep(rtconfig, simtime, {kind: "event", ...e}, ast);
            rtconfig = bigstep.rtconfig;
            fairSteps = [...fairSteps, ...bigstep.fairSteps];

            // accumulate output events from all big steps
            outputs = [...outputs, ...getOutputEventsFromBigStep(bigstep)];
          }
          return {kind: "bigstep", simtime, rtconfig, fairSteps} as TraceBigStep;
        },
        state => ({
          state,
          outputQueue: outputs,
        } as SC2DEVSState),
        error => ({
          state: error,
          outputQueue: [],
        } as SC2DEVSState),
      );
    },

    inputs: ast.inputEvents.map(e => e.event),
    outputs: [...ast.outputEvents],
  }
}

// basically a wrapper around our 'makeBigStep' function that catches any runtime errors.
function catchRuntimeError<IntermediaryResultType, ResultType>(
  doSomething: () => IntermediaryResultType,
  onSuccess: ((result: IntermediaryResultType) => ResultType),
  onError: (e: RuntimeError) => ResultType,
) {
  try {
    return onSuccess(doSomething());
  } catch (e) {
    if (e instanceof RuntimeError) {
      return onError(e);
    }
    else {
      throw e; // <-- none of my business!
    }
  }
};
