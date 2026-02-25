// DEVS adapter for Statecharts

import { Statechart } from "@/statecharts/abstract_syntax";
import { BigStep, NormalEvent, RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "./devs";
import { initialize, makeBigStep } from "@/statecharts/interpreter";

// When we wrap a Statechart in an atomic DEVS, this is the type of its DEVS-state:
export type Statechart2DEVSState = {
  // todo: the microsteps are a bit 'hacked in'... should clean this up...
  // they should just be returned by the interpreter itself instead of via this weird 'tracer' construction.
  bigstep: BigStep & { microsteps: string[] },

  // a Statechart can output events when it responds to an input event, but this is not allowed in an extTransition in DEVS. Therefore, we store all these output events in our internal state, such that we can output them in a follow-up intTransition:
  outputQueue: RaisedEvent[],
}

// this whole tracer thing is a bit hacky, see comment above...
const makeTracer = (indent: number, msgs: string[]) => ({
  log: (msg: string) => msgs.push(' '.repeat(indent) + msg),
  indent: () => makeTracer(indent + 1, msgs),
});
const newTracer = () => {
  const msgs = [] as string[];
  const tracer = makeTracer(0, msgs);
  return [msgs, tracer] as const;
}

// Wraps a Statechart in a DEVS component
export function sc2DEVS(ast: Statechart): DEVSComponent<Statechart2DEVSState> {
  return {
    initial: () => {
      const [microsteps, tracer] = newTracer();
      const bigstep = initialize(ast, tracer);
      return {
        bigstep: {...bigstep, microsteps},
        outputQueue: bigstep.outputEvents,
      };
    },
    timeAdvance: (c: Statechart2DEVSState) => {
      if (c.outputQueue.length > 0) {
        return 0;
      }
      if (c.bigstep.timers[0]) {
        return c.bigstep.timers[0][0];
      }
      return Infinity;
    },
    intTransition: (c: Statechart2DEVSState) => {
      if (c.outputQueue.length > 0) {
        // output our output events and do nothing else:
        return [c.outputQueue, {
          bigstep: c.bigstep,
          outputQueue: [],
        }];
      }
      if (c.bigstep.timers.length === 0) {
        throw new Error("cannot make intTransition - timeAdvance is infinity")
      }
      // pop timer:
      const [[when, timerElapseEvent], ...remainingTimers] = c.bigstep.timers;
      // handle timer event:
      const newC = {...c.bigstep, timers: remainingTimers, simtime: when};
      const [microsteps, tracer] = newTracer();
      const bigStep = makeBigStep(newC, timerElapseEvent, ast, tracer);
      // done
      return [bigStep.outputEvents, {
        bigstep: {...bigStep, microsteps},
        outputQueue: [], // <-- we immediately output our output events
      }];
    },
    extTransition: (simtime: number, c: Statechart2DEVSState, e: NormalEvent) => {
      const [microsteps, tracer] = newTracer();
      const bigStep = makeBigStep({...c.bigstep, simtime}, e, ast, tracer);
      const result = {
        bigstep: {...bigStep, microsteps},
        // append output events to output queue:
        outputQueue: [...c.outputQueue, ...bigStep.outputEvents],
      };
      return result;
    },

    inputs: ast.inputEvents.map(e => e.event),
    outputs: [...ast.outputEvents],
  }
}
