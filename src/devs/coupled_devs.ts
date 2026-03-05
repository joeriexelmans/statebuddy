import { RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "./devs";

export type Model2ModelConn = {
  outputModelName: string, // name of sending model
  outputEvent: string, // name of sending model's output event
  inputModelName: string, // name of receiving model
  inputEvent: string, // name of receiving model's input event
};

export type CoupledDEVSConns = {
  inputs: {
    coupledInputEvent: string, // name of coupled DEVS input event
    inputModelName: string, // name of receiving model
    inputEvent: string, // name of receiving model's input event
  }[],
  outputs: {
    outputModelName: string, // name of sending model
    outputEvent: string, // name of sending model's output event
    coupledOutputEvent: string, // name of coupled DEVS output event
  }[],
  model2Model: Model2ModelConn[],
};

export type CoupledDEVSState<ComponentStateType> = {
  [name: string]: ComponentStateType,
};

// Given a bunch of sub-components and routing connections, creates a Coupled DEVS.
// One deviation from 'real DEVS' is that there is no tie breaking function.
export function makeCoupledDEVS<T extends CoupledDEVSState<any>>(
  models: {[modelId in keyof T]: DEVSComponent<T[modelId]>},
  conns: CoupledDEVSConns,
  inputs: string[],
  outputs: string[],
): DEVSComponent<T> {

  // Route all coupled inputs or component outputs to their input component(s)
  // The result is a mapping from component to bag of inputs for that component.
  const routeEvents = (bagOfEvents: RaisedEvent[], getRoutings: (e: RaisedEvent) => {inputModelName: string, inputEvent: string}[]) => {
    const routedEvents = new Map<string, RaisedEvent[]>; // mapping from component name to bag of inputs for that component
    for (const e of bagOfEvents) {
      const routings = getRoutings(e);
      for (const {inputModelName, inputEvent} of routings) {
        routedEvents.set(inputModelName, [
          ...(routedEvents.get(inputModelName) || []),
          {
            // kind: "event" as const,
            name: inputEvent,
            param: e.param,
          },
        ]);
      }
    }
    return routedEvents;
  }

  const routeInputEvents = (bagOfInputs: RaisedEvent[]) => {
    return routeEvents(bagOfInputs, (coupledInputEvent => {
      const routings = conns.inputs.filter(conn => conn.coupledInputEvent === coupledInputEvent.name);
      // if (routings.length === 0) {
      //   console.debug(coupledInputEvent.name, 'goes nowhere');
      // }
      for (const {inputModelName, inputEvent} of routings) {
        console.debug(`${coupledInputEvent.name} -> ${inputModelName}.${inputEvent}`);
      }
      return routings;
    }));
  };

  const routeModel2ModelEvents = (outputModelName: string, bagOfOutputs: RaisedEvent[]) => {
    return routeEvents(bagOfOutputs, (outputEvent => {
      const routings = conns.model2Model.filter(conn =>
        conn.outputModelName === outputModelName
        && conn.outputEvent === outputEvent.name
      );
      // if (routings.length === 0) {
      //   console.debug(`${outputModelName}.${outputEvent.name} goes nowhere`);
      // }
      for (const {inputModelName, inputEvent} of routings) {
        console.debug(`${outputModelName}.${outputEvent.name} -> ${inputModelName}.${inputEvent}`);
      }
      return routings;
    }));
  }

  return {
    initial: () => {
      // initialize every component
      return Object.fromEntries(
        Object.entries(models)
          .map(([modelId, model]) => 
              [modelId, model.initial()])) as T;
    },

    timeAdvance: (c) => {
      // timeAdvance is equal to lowest of all timeAdvances
      return Object.entries(models)
        .reduce((acc, [name, {timeAdvance}]) =>
          Math.min(timeAdvance(c[name]), acc), Infinity);
    },

    intTransition: (c) => {
      // find earliest internal transition among all models:
      const [earliest, modelId] = Object.entries(models)
        .reduce(([earliestSoFar, earliestModel], [modelId, {timeAdvance}]) => {
          const when = timeAdvance(c[modelId]);
          if (when < earliestSoFar) {
            return [when, modelId] as [number, string];
          }
          return [earliestSoFar, earliestModel];
        }, [Infinity, null] as [number, string | null]);
      if (modelId !== null) {
        // 1. intTransition ...
        const [outputEvents, newConfig] = models[modelId].intTransition(c[modelId]);
        c = {
          ...c,
          [modelId]: newConfig,
        } as T;
        // 2. other components can make at most one extTransition ...
        const routedEvents = routeModel2ModelEvents(modelId, outputEvents);
        for (const [inputModelName, bagOfInputs] of routedEvents) {
          // output event goes to another (or the same?) model
          // -> that model makes an extTransition immediately, as part of the current coupled intTransition.
          c = {
            ...c,
            [inputModelName]: models[inputModelName].extTransition(earliest, c[inputModelName], bagOfInputs),
          };
        }
        // 3. coupled outputs ...
        const coupledOutputs = [] as RaisedEvent[];
        for (const outputEvent of outputEvents) {
          const routings2Output = conns.outputs.filter(conn =>
              conn.outputModelName === modelId && conn.outputEvent === outputEvent.name);
          for (const {coupledOutputEvent} of routings2Output) {
            console.debug(`${modelId}.${outputEvent.name} -> ${coupledOutputEvent}`);
            coupledOutputs.push({
              name: coupledOutputEvent,
              param: outputEvent.param,
            });
          }
        }
        return [coupledOutputs, c];
      }
      throw new Error("cannot make intTransition - timeAdvance is infinity");
    },

    extTransition: (simtime, c, bagOfInputs) => {
      const routedEvents = routeInputEvents(bagOfInputs);
      for (const [inputModelName, bagOfInputs] of routedEvents) {
        c = {
          ...c,
          [inputModelName]: models[inputModelName].extTransition(simtime, c[inputModelName], bagOfInputs),
        };
      }
      return c;
    },

    inputs,
    outputs,
  }
}
