import { CoupledState } from "../hooks/useSimulator";
import { PlantsState } from "../migrations/v1_types";
import { DEVSTrace } from "@/devs/trace";
import { Statechart } from "@/statecharts/abstract_syntax";
import { statebuddyPlants } from "../plants";

export type PropertyTrace = [number, boolean][]; // list of tuples [timestamp, true or false]

// The successful evaluation of a property is again a trace (of booleans).
export type PropertyCheckResult =
    [PropertyTrace, undefined] // <-- success
  | [undefined, string]; // <-- error message

// Bunch of traces in a format that the property checker can deal with
export type PreparedTraces = { [name: string]: PropertyTrace };

// Given a coupled DEVS execution trace, turn it into a bunch of signals that our MTL property checker understands.
export function prepareTraces(ast: Statechart, plantsState: PlantsState, trace: DEVSTrace<CoupledState>): PreparedTraces {  
  const result = {} as {[key: string]: PropertyTrace};

  for (const signal of [
    ...ast.inputEvents.map(e => `in_${e.event}`),
    ...[...ast.outputEvents].map(e => `out_${e}`),
    // ...plantsState.plants.flatMap(p => lookupPlant(p.type)?.signals.map(s => p.name+'_'+s) || []),
  ]) {
    result[signal] = [[0, false]];
  }
  for (const item of trace) {
    // log output events...
    if (item.kind === "intTransition") {
      for (const {name, param} of item.outputEvents) {
        // add entry to our state for each output event
        appendToSignal(result, `out_${name}`, item.simtime, param);
      }
    }
    // log input events...
    else if (item.kind === "extTransition") {
      for (const {name, param} of item.bagOfInputs) {
        appendToSignal(result, `in_${name}`, item.simtime, param);
      }
    }

    // log plant state...
    for (const [modelId, modelTrace] of Object.entries(item.newState)) {
      const plantInstance = plantsState.plants.find(({id}) => id === modelId);
      if (plantInstance) {
        const plant = statebuddyPlants[plantInstance.type];
        if (plant) {
          const modelState = modelTrace.at(-1)!.newState;
          const cleanedState = plant.plant.cleanupState(modelState); // state as a JSON-like object
          // console.log(item.simtime, cleanedState);
          for (const [key, val] of Object.entries(cleanedState)) {
            appendToSignal(result, `${plantInstance.name}_${key}`, item.simtime, Boolean(val));
          }
        }
      }
    }
  }
  return result;
}

function appendToSignal(traces: {[key: string]: [number, boolean][]}, key: string, simtime: number, value: boolean) {
  const lastValue = traces[key]?.at(-1)?.[1]; // <-- initially every signal is false
  if (lastValue === undefined || value !== lastValue) {
    traces[key] = [
      ...(traces[key] || []),
      [simtime, value],
    ];
  }
}
