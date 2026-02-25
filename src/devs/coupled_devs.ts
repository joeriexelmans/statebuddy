import { NormalEvent, RaisedEvent } from "@/statecharts/runtime_types";
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

type CoupledDEVSState = {
  [name: string]: any, // <-- the state type of every component can be anything
};

// Given a bunch of sub-components and routing connections, creates a Coupled DEVS.
// One deviation from 'real DEVS' is that there is no tie breaking function.
export function makeCoupledDEVS<T extends CoupledDEVSState>(
  models: {[modelId in keyof T]: DEVSComponent<T[modelId]>},
  conns: CoupledDEVSConns,
  inputs: string[],
  outputs: string[],
): DEVSComponent<T> {

  function makeModelExtTransition(simtime: number, c: T, model: string, e: NormalEvent) {
    // const newConfig = models[model].extTransition(simtime, c[model], e);
    // return {
    //   ...c,
    //   [model]: newConfig,
    // };
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
        const [outputEvents, newConfig] = models[modelId].intTransition(c[modelId]);
        c = {
          ...c,
          [modelId]: newConfig,
        } as T;
        const coupledOutputs = [] as RaisedEvent[];
        for (const outputEvent of outputEvents) {
          const routings2Model = conns.model2Model.filter(conn =>
            conn.outputModelName === modelId && conn.outputEvent === outputEvent.name);
          for (const {inputModelName, inputEvent} of routings2Model) {
            // output event goes to another (or the same?) model
            // -> that model makes an extTransition immediately, as part of the current coupled intTransition.
            console.debug(`${modelId}.${outputEvent.name} -> ${inputModelName}.${inputEvent}`);
            const toRaise = {
                kind: "event" as const,
                name: inputEvent,
                param: outputEvent.param,
            };
            c = {
              ...c,
              [inputModelName]: models[inputModelName].extTransition(earliest, c[inputModelName], toRaise),
            };
          }
          const routings2Output = conns.outputs.filter(conn =>
              conn.outputModelName === modelId && conn.outputEvent === outputEvent.name);
          for (const {coupledOutputEvent} of routings2Output) {
            console.debug(`${modelId}.${outputEvent.name} -> coupled ouput ${coupledOutputEvent}`);
            coupledOutputs.push({
              name: coupledOutputEvent,
              param: outputEvent.param,
            });
          }
          if (routings2Model.length === 0 && routings2Output.length === 0) {
            console.debug(`${modelId}.${outputEvent.name} goes nowhere`);
          }
        }
        return [coupledOutputs, c];
      }
      throw new Error("cannot make intTransition - timeAdvance is infinity");
    },
    extTransition: (simtime, c, e) => {
      const routings = conns.inputs.filter(conn => conn.coupledInputEvent === e.name);
      if (routings.length === 0) {
        console.debug('coupled input', e.name, 'goes nowhere');
      }
      for (const {inputModelName, inputEvent} of routings) {
        console.debug('coupled input', e.name, '->', `${inputModelName}.${inputEvent}`);
        const raisedEvent: NormalEvent = {
          kind: "event" as const,
          name: inputEvent,
          param: e.param,
        };
        c = {
          ...c,
          [inputModelName]: models[inputModelName].extTransition(simtime, c[inputModelName], raisedEvent),
        };
      }
      return c;
    },

    inputs,
    outputs,
  }
}
