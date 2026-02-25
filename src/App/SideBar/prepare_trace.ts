import { CoupledState, PlantsState } from "../hooks/useSimulator";
import { DEVSTrace } from "@/devs/trace";
import { lookupPlant } from "../plants";

export type PropertyTrace = [number, boolean][];

// The successful evaluation of a property is again a trace (of booleans).
export type PropertyCheckResult =
    [PropertyTrace, null] // <-- success
  | [null, string]; // <-- error message

// Bunch of traces in a format that the property checker can deal with
export type PreparedTraces = { [name: string]: PropertyTrace };

// Given a coupled DEVS execution trace, turn it into a bunch of signals that our MTL property checker understands.
export function prepareTraces(plantsState: PlantsState, trace: DEVSTrace<CoupledState>): PreparedTraces {  
  const result = {} as {[key: string]: [number, boolean][]};

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
      const {eventName, param} = item;
      appendToSignal(result, `in_${eventName}`, item.simtime, param);
    }
    
    // log plant state...
    if (item.result.ok) {
      for (const [modelId, modelState] of Object.entries(item.result.newState)) {
        const plantInstance = plantsState.plants.find(({id}) => id === modelId);
        if (plantInstance) {
          const plant = lookupPlant(plantInstance.type);
          if (plant) {
            const cleanedState = plant.cleanupState(modelState); // state as a JSON-like object
            for (const [key, val] of Object.entries(cleanedState)) {
              appendToSignal(result, `${plantInstance.name}_${key}`, item.simtime, Boolean(val));
            }
          }
        }
      }
    }
  }
  return result;
}

function appendToSignal(traces: {[key: string]: [number, boolean][]}, key: string, simtime: number, value: boolean) {
  const lastValue = traces[key]?.at(-1)?.[1] || false; // <-- initially every signal is false
  if (value !== lastValue) {
    traces[key] = [
      ...(traces[key] || []),
      [simtime, value],
    ];
  }
}
