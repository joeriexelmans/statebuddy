// DEVS adapter for Statecharts

import { Statechart } from "@/statecharts/abstract_syntax";
import { BigStep, RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "./devs";
import { initialize, makeBigStep, RuntimeError } from "@/statecharts/interpreter";
import { newTracer } from "@/statecharts/tracer";

// When we wrap a Statechart in an atomic DEVS, this is the type of its DEVS-state:
export type SC2DEVSState = {
  // todo: the microsteps are def a bit 'hacked in'... should clean this up...
  // they should just be returned by the interpreter itself instead of via this weird 'tracer' construction.
  bigstep: BigStep & { microsteps: string[] },

  // a Statechart can output events when it responds to an input event, but this is not allowed in an extTransition in DEVS. Therefore, we store all these output events in our internal state, such that we can output them in a follow-up intTransition:
  outputQueue: RaisedEvent[],
} | RuntimeError;

// Wraps a Statechart in a DEVS component
export function sc2DEVS(ast: Statechart): DEVSComponent<SC2DEVSState> {
  return {
    initial: () => {
      const [microsteps, tracer] = newTracer();
      return catchRuntimeError(
        () => initialize(ast, tracer),
        bigstep => ({
          bigstep: {...bigstep, microsteps},
          outputQueue: bigstep.outputEvents,
        }),
        e => e as SC2DEVSState,
      );
    },
    timeAdvance: (c: SC2DEVSState) => {
      if (c instanceof RuntimeError) {
        // the statechart crashed, cannot advance any further :(
        return Infinity;
      }
      if (c.outputQueue.length > 0) {
        return c.bigstep.simtime; // immediately (= current simulated time)
      }
      if (c.bigstep.timers[0]) {
        return c.bigstep.timers[0][0];
      }
      return Infinity;
    },
    intTransition: (c: SC2DEVSState) => {
      if (c instanceof RuntimeError) {
        throw new Error("cannot make intTransition - the Statechart has crashed");
      }
      if (c.outputQueue.length > 0) {
        // output our output events and do nothing else:
        return [c.outputQueue, {
          bigstep: c.bigstep,
          outputQueue: [],
        }];
      }
      if (c.bigstep.timers.length === 0) {
        throw new Error("cannot make intTransition - timeAdvance is infinity");
      }
      // pop timer:
      const [[when, timerElapseEvent], ...remainingTimers] = c.bigstep.timers;
      // handle timer event:
      const newC = {...c.bigstep, timers: remainingTimers, simtime: when};
      const [microsteps, tracer] = newTracer();
      // let outputEvents = [] as RaisedEvent[];
      return catchRuntimeError(
        () => {
          const bigstep = makeBigStep(newC, timerElapseEvent, ast, tracer);
          return [bigstep.outputEvents, bigstep] as const;
        },
        ([outputEvents, bigstep]) => [
          outputEvents,
          {
            bigstep: {...bigstep, microsteps},
            outputQueue: [],
          },
        ] as const,
        e => [[] as RaisedEvent[], e as SC2DEVSState],
      )
    },
    // Small mismatch here: A Statechart will only handle one input event at a time, but DEVS supports a bag of inputs. We just handle all the inputs sequentially (one RTC step per input event). So an extTransition can actually consist of more than one RTC step.
    extTransition: (simtime: number, c: SC2DEVSState, bagOfInputs: RaisedEvent[]) => {
      if (c instanceof RuntimeError) {
        return new RuntimeError(`ignoring input - error in previous step`, []); // ignore input
      }
      const [microsteps, tracer] = newTracer();
      let bigstep = c.bigstep as BigStep;
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
          bigstep: {...bigstep, microsteps},
          outputQueue: outputs,
        }),
        e => e as SC2DEVSState,
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
