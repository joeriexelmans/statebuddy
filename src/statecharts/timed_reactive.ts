import { Statechart } from "./abstract_syntax";
import { handleInputEvent, initialize } from "./interpreter";
import { BigStepOutput, InputEvent, RaisedEvent, RT_Statechart, Timers } from "./runtime_types";

// an abstract interface for timed reactive discrete event systems somewhat similar but not equal to DEVS
// differences from DEVS:
//   - extTransition can have output events
//   - time is kept as absolute simulated time (since beginning of simulation), not relative to the last transition
export type TimedReactive<RT_Config> = {
  initial: () => RT_Config,
  timeAdvance: (c: RT_Config) => number,
  intTransition: (c: RT_Config) => [RaisedEvent[], RT_Config],
  extTransition: (simtime: number, c: RT_Config, e: InputEvent) => [RaisedEvent[], RT_Config],
}

export function statechartExecution(ast: Statechart): TimedReactive<BigStepOutput> {
  return {
    initial: () => initialize(ast),
    timeAdvance: (c: RT_Statechart) => (c.environment.get("_timers") as Timers)[0]?.[0] || Infinity,
    intTransition: (c: RT_Statechart) => {
      const timers = c.environment.get("_timers") as Timers;
      if (timers.length === 0) {
        throw new Error("cannot make intTransition - timeAdvance is infinity")
      }
      const [when, timerElapseEvent] = timers[0];
      const {outputEvents, ...rest} = handleInputEvent(when, timerElapseEvent, ast, c);
      return [outputEvents, {outputEvents, ...rest}];
    },
    extTransition: (simtime: number, c: RT_Statechart, e: InputEvent) => {
      const {outputEvents, ...rest} = handleInputEvent(simtime, e, ast, c);
      return [outputEvents, {outputEvents, ...rest}];
    }
  }
}

export const dummyExecution: TimedReactive<null> = {
  initial: () => null,
  timeAdvance: () => Infinity,
  intTransition: () => { throw new Error("dummy never makes intTransition"); },
  extTransition: () => [[], null],
};

export type EventDestination = ModelDestination | OutputDestination;

export type ModelDestination = {
  kind: "model",
  model: string,
  eventName: string,
};

export type OutputDestination = {
  kind: "output",
  eventName: string,
};

export function exposeStatechartInputs(ast: Statechart, model: string): Conns {
  return {
    inputEvents: Object.fromEntries(ast.inputEvents.map(e => [e.event, {kind: "model", model, eventName: e.event}])),
    outputEvents: {},
  }
}

export type Conns = {
  // inputs coming from outside are routed to the right models
  inputEvents: {[eventName: string]: ModelDestination},

  // outputs coming from the models are routed to other models or to outside
  outputEvents: {[modelName: string]: {[eventName: string]: EventDestination}},
}

export function coupledExecution<T extends {[name: string]: any}>(models: {[name in keyof T]: TimedReactive<T[name]>}, conns: Conns): TimedReactive<T> {

  function makeModelExtTransition(simtime: number, c: T, model: string, e: InputEvent) {
    const [outputEvents, newConfig] = models[model].extTransition(simtime, c[model], e);
    return processOutputs(simtime, outputEvents, model, {
      ...c,
      [model]: newConfig,
    });
  }

  // one model's output events are possibly input events for another model.
  function processOutputs(simtime: number, events: RaisedEvent[], model: string, c: T): [RaisedEvent[], T] {
    if (events.length > 0) {
      const [event, ...rest] = events;
      const destination = conns.outputEvents[model]?.[event.name];
      if (destination === undefined) {
        // ignore
        return processOutputs(simtime, rest, model, c);
      }
      if (destination.kind === "model") {
        // output event is input for another model
        const inputEvent = {
          kind: "input" as const,
          name: destination.eventName,
          param: event.param,
        };
        const [outputEvents, newConfig] = makeModelExtTransition(simtime, c, destination.model, inputEvent);

        // proceed with 'rest':
        const [restOutputEvents, newConfig2] = processOutputs(simtime, rest, model, newConfig);
        return [[...outputEvents, ...restOutputEvents], newConfig2];
      }
      else {
        // kind === "output"
        const [outputEvents, newConfig] = processOutputs(simtime, rest, model, c);
        return [[event, ...outputEvents], newConfig];
      }
    }
    else {
      return [[], c];
    }
  }

  return {
    initial: () => Object.fromEntries(Object.entries(models).map(([name, model]) => {
      return [name, model.initial()];
    })) as T,
    timeAdvance: (c) => {
      return Object.entries(models).reduce((acc, [name, {timeAdvance}]) => Math.min(timeAdvance(c[name]), acc), Infinity);
    },
    intTransition: (c) => {
      const [when, name] = Object.entries(models).reduce(([earliestSoFar, earliestModel], [name, {timeAdvance}]) => {
        const when = timeAdvance(c[name]);
        if (when < earliestSoFar) {
          return [when, name] as [number, string];
        }
        return [earliestSoFar, earliestModel];
      }, [Infinity, null] as [number, string | null]);
      if (name !== null) {
        const [outputEvents, newConfig] = models[name].intTransition(c[name]);
        return processOutputs(when, outputEvents, name, {...c, [name]: newConfig});
      }
      throw new Error("cannot make intTransition - timeAdvance is infinity");
    },
    extTransition: (simtime, c, e) => {
      const {model, eventName} = conns.inputEvents[e.name];
      // console.log('input event', e, 'goes to', model);
      const inputEvent: InputEvent = {
        kind: "input",
        name: eventName,
        param: e.param,
      };
      return makeModelExtTransition(simtime, c, model, inputEvent);
    },
  }
}
