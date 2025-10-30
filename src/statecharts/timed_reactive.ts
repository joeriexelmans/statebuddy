import { Statechart } from "./abstract_syntax";
import { handleInputEvent, initialize, RuntimeError } from "./interpreter";
import { BigStep, InputEvent, RaisedEvent, RT_Statechart, Timers } from "./runtime_types";

// an abstract interface for timed reactive discrete event systems somewhat similar but not equal to DEVS
// differences from DEVS:
//   - extTransition can have output events
//   - time is kept as absolute simulated time (since beginning of simulation), not relative to the last transition
export type TimedReactive<RT_Config> = {
  initial: () => [RaisedEvent[], RT_Config],
  timeAdvance: (c: RT_Config) => number,
  intTransition: (c: RT_Config) => [RaisedEvent[], RT_Config],
  extTransition: (simtime: number, c: RT_Config, e: InputEvent) => [RaisedEvent[], RT_Config],

  // inputEvents: string[],
  // outputEvents: string[],
}

export function statechartExecution(ast: Statechart): TimedReactive<BigStep> {
  return {
    initial: () => {
      const bigstep = initialize(ast);
      return [bigstep.outputEvents, bigstep];
    },
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
    },

    // inputEvents: ast.inputEvents.map(e => e.event),
    // outputEvents: [...ast.outputEvents],
  }
}

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

// export type NowhereDestination = {
//   kind: "nowhere",
// };

// export function exposeStatechartInputsOutputs(ast: Statechart, model: string): Conns {
//   return {
//     // all the coupled execution's input events become input events for the statechart
//     inputEvents: exposeStatechartInputs(ast, model),
//     outputEvents: exposeStatechartOutputs(ast, model),
//   }
// }

// export function exposeStatechartInputs(ast: Statechart, model: string, tfm = (s: string) => s): {[eventName: string]: ModelDestination} {
//   return Object.fromEntries(ast.inputEvents.map(e => [tfm(e.event), {kind: "model", model, eventName: e.event}]));
// }

// export function exposeStatechartOutputs(ast: Statechart, model: string): {[modelName: string]: {[eventName: string]: EventDestination}} {
//   return {
//     // all the statechart's output events become output events of our coupled execution
//     [model]: Object.fromEntries([...ast.outputEvents].map(e => [e, {kind: "output", model, eventName: e}])),
//   };
// }

// export function hideStatechartOutputs(ast: Statechart, model: string) {
//   return {
//     [model]: Object.fromEntries([...ast.outputEvents].map(e => [e, {kind: "nowhere" as const}])),
//   }
// }

// export type Conns = {
//   // inputs coming from outside are routed to the right models
//   inputEvents: {[eventName: string]: ModelDestination},

//   // outputs coming from the models are routed to other models or to outside
//   outputEvents: {[modelName: string]: {[eventName: string]: EventDestination}},
// }


// maps source to target. e.g.:
// {
//  "sc.incTime": ["plant", "incTime"],
//  "DEBUG_topRightClicked": ["sc", "topRightClicked"],
// }
export type Conns = {[eventName: string]: [string|null, string]};

export function coupledExecution<T extends {[name: string]: any}>(models: {[name in keyof T]: TimedReactive<T[name]>}, conns: Conns, /*inputEvents: string[], outputEvents: []*/): TimedReactive<T> {

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
      const destination = conns[model+'.'+event.name];
      if (destination === undefined) {
        // ignore
        console.log(`${model}.${event.name} goes nowhere`);
        return processOutputs(simtime, rest, model, c);
      }
      const [destinationModel, destinationEventName] = destination;
      if (destinationModel !== null) {
        // output event is input for another model
        console.log(`${model}.${event.name} goes to ${destinationModel}.${destinationEventName}`);
        const inputEvent = {
          kind: "input" as const,
          name: destinationEventName,
          param: event.param,
        };
        const [outputEvents, newConfig] = makeModelExtTransition(simtime, c, destinationModel, inputEvent);

        // proceed with 'rest':
        const [restOutputEvents, newConfig2] = processOutputs(simtime, rest, model, newConfig);
        return [[...outputEvents, ...restOutputEvents], newConfig2];
      }
      else {
        // event is output event of our coupled execution
        console.log(`${model}.${event.name} becomes ^${destinationEventName}`);
        const [outputEvents, newConfig] = processOutputs(simtime, rest, model, c);
        return [[event, ...outputEvents], newConfig];
      }
    }
    else {
      return [[], c];
    }
  }

  return {
    initial: () => {
      // 1. initialize every model
      const allOutputs = [];
      let state = {} as T;
      for (const [modelName, model] of Object.entries(models)) {
        const [outputEvents, modelState] = model.initial();
        for (const o of outputEvents) {
          allOutputs.push([modelName, o]);
        }
        // @ts-ignore
        state[modelName] = modelState;
      }
      // 2. handle all output events (models' outputs may be inputs for each other)
      let finalOutputs = [];
      for (const [modelName, outputEvents] of allOutputs) {
        let newOutputs;
        [newOutputs, state] = processOutputs(0, outputEvents, modelName, state);
        finalOutputs.push(...newOutputs);
      }
      return [finalOutputs, state];
    },
    timeAdvance: (c) => {
      return Object.entries(models).reduce((acc, [name, {timeAdvance}]) => Math.min(timeAdvance(c[name]), acc), Infinity);
    },
    intTransition: (c) => {
      // find earliest internal transition among all models:
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
      if (!Object.hasOwn(conns, e.name)) {
        console.warn('input event', e.name, 'goes to nowhere');
        return [[], c];
      }
      else {
        const [model, eventName] = conns[e.name];
        if (model !== null) {
          console.log('input event', e.name, 'goes to', `${model}.${eventName}`);
          const inputEvent: InputEvent = {
            kind: "input",
            name: eventName,
            param: e.param,
          };
          return makeModelExtTransition(simtime, c, model, inputEvent);
        }
        else {
          throw new Error("not implemented: input event becoming output event right away.")
        }
      }
    },
    // inputEvents,
    // outputEvents,
  }
}


// Example of a coupled execution:

// const clock1: TimedReactive<{nextTick: number}> = {
//   initial: () => ({nextTick: 1}),
//   timeAdvance: (c) => c.nextTick,
//   intTransition: (c) => [[{name: "tick"}], {nextTick: c.nextTick+1}],
//   extTransition: (simtime, c, e) => [[], (c)],
// }

// const clock2: TimedReactive<{nextTick: number}> = {
//   initial: () => ({nextTick: 0.5}),
//   timeAdvance: (c) => c.nextTick,
//   intTransition: (c) => [[{name: "tick"}], {nextTick: c.nextTick+1}],
//   extTransition: (simtime, c, e) => [[], (c)],
// }

// const coupled = coupledExecution({clock1, clock2}, {inputEvents: {}, outputEvents: {
//   clock1: {tick: {kind:"output", eventName: 'tick'}},
//   clock2: {tick: {kind:"output", eventName: 'tick'}},
// }})

// let state = coupled.initial();
// for (let i=0; i<10; i++) {
//   const nextWakeup = coupled.timeAdvance(state);
//   console.log({state, nextWakeup});
//   [[], state] = coupled.intTransition(state);
// }
