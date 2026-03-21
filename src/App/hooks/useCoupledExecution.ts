import { CoupledDEVSConns, makeCoupledDEVS } from "@/devs/coupled_devs";
import { makeTracedDEVS } from "@/devs/trace";
import { useMemo } from "react";
import { statebuddyPlants } from "../plants";
import { Statechart } from "@/statecharts/abstract_syntax";
import { sc2DEVS } from "@/devs/sc2devs";
import { PlantsState } from "../migrations/v1_types";

export function useCoupledExecution(ast: Statechart|undefined, plantsState: PlantsState) {
  const plantInstances = useMemo(() =>
    plantsState.plants.map(({id, type}) => [id, statebuddyPlants[type]!] as const),
    [plantsState]
  );

  const tracedSC2DEVS = useMemo(() => ast && makeTracedDEVS(sc2DEVS(ast)), [ast]);

  const hardwiredSCInputs = useMemo(() =>
    // expose all SC input events
    ast?.inputEvents.map(({event}) => ({
      coupledInputEvent: event,
      inputModelName: "sc",
      inputEvent: event,
    })) || [],
  [ast?.inputEvents]);

  const hardwiredSCOutputs = useMemo(() =>
    // Expose all output events of the statechart as outputs of the Coupled DEVS
    // The MTL property checker and the Plot-component will treat these output events as signals.
    ast && [...ast.outputEvents].map(event => ({
      outputModelName: "sc",
      outputEvent: event,
      coupledOutputEvent: event,
    })) || [],
  [ast?.outputEvents]);

  const coupledExecution = useMemo(() => ast && makeTracedDEVS(makeCoupledDEVS(
    {
      sc: tracedSC2DEVS!,
      ...Object.fromEntries(plantInstances.map(([id, plant]) => [id, makeTracedDEVS(plant.plant.execution)])),
    }, {
      // hard-wired connections:
      inputs: [
        ...hardwiredSCInputs,
        ...plantInstances.flatMap(([id, plant]) => plant.plant.uiEvents.map(uiEvent => ({
          coupledInputEvent: uiEvent.event,
          inputModelName: id,
          inputEvent: uiEvent.event,
        }))),
      ],
      outputs: hardwiredSCOutputs,

      // the user-configurable part:
      model2Model: plantsState.conns,

    } as CoupledDEVSConns,
    ast.inputEvents.map(({event}) => event), // <-- every SC input becomes coupled input
    [...ast.outputEvents], // <-- every SC output becomes coupled output
  )),
  [ast, plantsState]);

  return coupledExecution;
}

