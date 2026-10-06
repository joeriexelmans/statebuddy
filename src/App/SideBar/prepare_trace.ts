import { CoupledState } from "../hooks/useSimulator";
import { PlantsState } from "../migrations/v1_types";
import { DEVSTrace } from "@/devs/trace";
import { Statechart } from "@/statecharts/abstract_syntax";
import { statebuddyPlants } from "../plants";
import { PreparedTrace, PropertyTrace } from "./prepare_trace_types";

// Given a coupled DEVS execution trace, turn it into a bunch of signals that our MTL property checker understands.
// The same signal traces are also displayed in the plot view.
// parameter mergeConnected: whether to merge two signals that are connected to each other in Coupled DEVS. They can effectively be treated as one and the same signal. This reduces clutter when listing all the signals.
export function prepareTraces(ast: Statechart, plantsState: PlantsState, trace: DEVSTrace<CoupledState>, mergeConnected = false): PreparedTrace {
  const result = {} as {[key: string]: PropertyTrace};

  function displayPrefix(componentId: string) {
    // return componentId === "sc" ? "" : plantsState.plants.find(p => p.id === componentId)!.name +".";
    return componentId === "sc" ? "" : plantsState.plants.find(p => p.id === componentId)!.name +"_";
  }

  function appendOutEvent(componentId: string, eventName: string, param: any, simtime: number) {
    const found = plantsState.conns.find(conn => !conn.suppress
      && conn.outputEvent === eventName && conn.outputModelName === componentId);
    if (mergeConnected && found) {
      // our output event connects to another component's input event
      // -> merge both signals
      appendToSignal(result, `${displayPrefix(componentId)}out_${eventName} ► ${displayPrefix(found.inputModelName)}in_${found.inputEvent}`, simtime, param);
    }
    else {
      appendToSignal(result, `${displayPrefix(componentId)}out_${eventName}`, simtime, param);
    }
  }

  function appendInEvent(componentId: string, eventName: string, param: any, simtime: number) {
    const found = plantsState.conns.find(conn => !conn.suppress &&
        (conn.outputEvent === eventName && conn.outputModelName === componentId
      ||  conn.inputEvent === eventName  && conn.inputModelName === componentId));

    if (!found || !mergeConnected) {
      appendToSignal(result, `${displayPrefix(componentId)}in_${eventName}`, simtime, param);
    }
  }

  // all signals are initially 'false'
  for (const e of ast.outputEvents) {
    appendOutEvent("sc", e, false, 0);
  }
  for (const e of ast.inputEvents) {
    appendInEvent("sc", e.event, false, 0);
  }
  for (const p of plantsState.plants) {
    const plantInstance = plantsState.plants.find(({id}) => id === p.id);
    const plant = plantInstance && statebuddyPlants[plantInstance.type];
    plant?.as?.inputEvents.forEach(i => appendInEvent(p.id, i.event, false, 0));
    plant?.as?.outputEvents.forEach(o => appendOutEvent(p.id, o, false, 0));
    plant?.plant.signals.forEach(s => appendToSignal(result, `${displayPrefix(p.id)}${s}`, 0, false));
  }

  function handleComponentTrace(componentId: string, trace: DEVSTrace<any>) {
    const plantInstance = plantsState.plants.find(({id}) => id === componentId);
    const plant = plantInstance && statebuddyPlants[plantInstance.type];

    for (const item of trace) {
      if (item.kind === "intTransition") {
        // output event
        for (const {name, param} of item.outputEvents) {
          appendOutEvent(componentId, name, param, item.simtime);
        }
      }
      else if (item.kind === "extTransition") {
        // input event
        for (const {name, param} of item.bagOfInputs) {
          appendInEvent(componentId, name, param, item.simtime);
        }
      }

      if (plant) {
        const cleanedState = plant.plant.cleanupState(item.newState); // state as a JSON-like object
        for (const [key, val] of Object.entries(cleanedState)) {
          appendToSignal(result, `${displayPrefix(componentId)}${key}`, item.simtime, Boolean(val));
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
      if (simtime === 0) {
        traces[key] = [[simtime, value]];
      }
      traces[key] = [[0, false], [simtime, value]];
    }
  }
}
