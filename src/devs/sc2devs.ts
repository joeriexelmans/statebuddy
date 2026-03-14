// DEVS adapter for Statecharts

import { Statechart } from "@/statecharts/abstract_syntax";
import { BigStep, RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "./devs";
import { initialize, makeBigStep, RuntimeError } from "@/statecharts/interpreter";
import { newTracer } from "@/statecharts/tracer";

// When we wrap a Statechart in an atomic DEVS, this is the type of its DEVS-state:
export type SC2DEVSState = {
  // The most up-to-date execution state.
  // If there is an error, then this DEVS component is in a special "error" state, where its intTransition is +Inf, and its extTransition doesn't do anything anymore.
  state: BigStep | RuntimeError,

  // The microsteps that were performed by the last big step.
  // todo: the microsteps are def a bit 'hacked in'... should clean this up...
  // they should just be returned by the interpreter itself instead of via this weird 'tracer' construction.
  microsteps: string[],

  // a Statechart can output events when it responds to an input event, but this is not allowed in an extTransition in DEVS. Therefore, we store all these output events in our internal state, such that we can output them in a follow-up intTransition:
  outputQueue: RaisedEvent[],
};

// Wraps a Statechart in a DEVS component
export function sc2DEVS(ast: Statechart): DEVSComponent<SC2DEVSState> {
  return {
    initial: () => {
      const [microsteps, tracer] = newTracer();
      return catchRuntimeError(
        () => initialize(ast, tracer),
        bigstep => ({
          state: bigstep,
          microsteps,
          outputQueue: bigstep.outputEvents,
        }),
        error => ({
          state: error,
          microsteps,
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
        return c.state.simtime; // immediately (= current simulated time)
      }
      if (c.state.timers[0]) {
        return c.state.timers[0][0];
      }
      return Infinity;
    },
    intTransition: (c: SC2DEVSState) => {
      if (c.state instanceof RuntimeError) {
        throw new Error("cannot make intTransition - the Statechart has crashed");
      }
      if (c.outputQueue.length > 0) {
        // output our output events and do nothing else:
        return [c.outputQueue, {
          state: c.state,
          microsteps: ["(produce output from previous step)"],
          outputQueue: [],
        }];
      }
      if (c.state.timers.length === 0) {
        throw new Error("cannot make intTransition - timeAdvance is infinity");
      }
      // pop timer:
      const [[when, timerElapseEvent], ...remainingTimers] = c.state.timers;
      // handle timer event:
      const newC = {...c.state, timers: remainingTimers, simtime: when};
      const [microsteps, tracer] = newTracer();
      // let outputEvents = [] as RaisedEvent[];
      return catchRuntimeError(
        () => {
          const bigstep = makeBigStep(newC, timerElapseEvent, ast, tracer);
          return bigstep;
        },
        bigstep => [
          bigstep.outputEvents,
          {
            state: bigstep,
            microsteps,
            outputQueue: [],
          } as SC2DEVSState,
        ] as const,
        error => [
          [] as RaisedEvent[],
          {
            state: error,
            microsteps,
            outputQueue: [],
          } as SC2DEVSState,
        ] as const,
      )
    },
    // Small mismatch here: A Statechart will only handle one input event at a time, but DEVS supports a bag of inputs. We just handle all the inputs sequentially (one RTC step per input event). So an extTransition can actually consist of more than one RTC step.
    extTransition: (simtime: number, c: SC2DEVSState, bagOfInputs: RaisedEvent[]) => {
      if (c.state instanceof RuntimeError) {
         // ignore
        return {
          state: new RuntimeError(`ignoring input - see earlier error`, []),
          microsteps: [],
          outputQueue: [],
        };
      }
      const [microsteps, tracer] = newTracer();
      let bigstep = c.state as BigStep;
      let outputs = c.outputQueue;
      // execute one big step for each input event:
      return catchRuntimeError(
        () => {
          for (const e of bagOfInputs) {
            bigstep = makeBigStep({...bigstep, simtime}, {kind: "event", ...e}, ast, tracer);
            // accumulate output events from all big steps
            outputs = [...outputs, ...bigstep.outputEvents];
          }
          return bigstep;
        },
        bigstep => ({
          state: bigstep,
          microsteps,
          outputQueue: outputs,
        } as SC2DEVSState),
        error => ({
          state: error,
          microsteps,
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
