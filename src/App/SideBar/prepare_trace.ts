import { CoupledState } from "../hooks/useSimulator";
import { PlantsState } from "../migrations/v1_types";
import { DEVSTrace } from "@/devs/trace";
import { Statechart } from "@/statecharts/abstract_syntax";
import { statebuddyPlants } from "../plants";
import { PreparedTrace, PropertyTrace } from "./prepare_trace_types";

// Given a coupled DEVS execution trace, turn it into a bunch of signals that our MTL property checker understands.
export function prepareTraces(ast: Statechart, plantsState: PlantsState, trace: DEVSTrace<CoupledState>): PreparedTrace {
  const result = {} as {[key: string]: PropertyTrace};

  function displayPrefix(componentId: string) {
    return componentId === "sc" ? "" : plantsState.plants.find(p => p.id === componentId)!.name +".";
  }

  function handleComponentTrace(componentId: string, trace: DEVSTrace<any>) {
    for (const item of trace) {
      if (item.kind === "intTransition") {
        // output event
        for (const {name, param} of item.outputEvents) {
          const found = plantsState.conns.find(conn => !conn.suppress
            && conn.outputEvent === name && conn.outputModelName === componentId);
          if (found) {
            // our output event connects to another component's input event
            // -> merge both signals
            appendToSignal(result, `↗${displayPrefix(componentId) + name} → ↘${displayPrefix(found.inputModelName) + found.inputEvent}`, item.simtime, param);
          }
          else {
            appendToSignal(result, `↗${displayPrefix(componentId) + name}`, item.simtime, param);
          }
        }
      }
      else if (item.kind === "extTransition") {
        // input event
        for (const {name, param} of item.bagOfInputs) {
          
          const found = plantsState.conns.find(conn => !conn.suppress &&
              (conn.outputEvent === name && conn.outputModelName === componentId
           ||  conn.inputEvent === name  && conn.inputModelName === componentId));

          console.log(name, param, componentId, found);

          if (!found) {
            // only show input event if our 
            appendToSignal(result, `↘${name}`, item.simtime, param);
          }
        }
      }
    }
  }

  for (const [name, tr] of Object.entries(trace.at(-1)!.newState)) {
    handleComponentTrace(name, tr);
  }

  return result;
}

function appendToSignal(traces: {[key: string]: [number, boolean][]}, key: string, simtime: number, value: boolean) {
  const lastValue = traces[key]?.at(-1)?.[1]; // <-- initially every signal is false
  if (lastValue === undefined || value !== lastValue) {
    // we mutate our trace in-place, profiling showed this is a crazy amount faster
    if (traces[key]) {
      traces[key].push([simtime, value]);
    }
    else {
      traces[key] = [[0, false], [simtime, value]];
    }
  }
}
