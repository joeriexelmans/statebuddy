import { CoupledDEVSConns, makeCoupledDEVS } from "@/devs/coupled_devs";
import { makeTracedDEVS } from "@/devs/trace";
import { useMemo } from "react";
import { statebuddyPlants } from "../plants";
import { Statechart } from "@/statecharts/abstract_syntax";
import { sc2DEVS } from "@/devs/sc2devs";
import { PlantsState } from "../migrations/v1_types";

// Every plant's UI input events are exposed as global (Coupled DEVS) input events.
// They must be prefixed with the plant ID, so they don't interact with each other.
export function prefixCoupledInputEvent(componentId: string, eventName: string) {
  // We use a character ($) that is illegal in statechart syntax, so surely the statechart cannot declare an input event with the same name.
  return "$" + componentId + "_" + eventName;
}

export function useCoupledExecution(ast: Statechart|undefined, plantsState: PlantsState) {
  const plantInstances = useMemo(() =>
    plantsState.plants.map(({id, type}) => [id, statebuddyPlants[type]!] as const),
    [plantsState]
  );

  const tracedSC2DEVS = useMemo(() => ast && makeTracedDEVS(sc2DEVS(ast)), [ast]);

  const coupledExecution = useMemo(() => {
    // Every statechart input event is exposed as a global input event.
    // This way, statechart input events can be raised interactively (by clicking on them in the 'input events' panel).
    const hardwiredSCInputs = ast?.inputEvents.map(({event}) => ({
        coupledInputEvent: prefixCoupledInputEvent("sc", event),
        inputModelName: "sc",
        inputEvent: event,
      })) || [];

    // Plants can also expose events that can be raised interactively (by clicking on UI elements).
    // These events go to the plant itself, which can then decide to expose it as an output event coming from itself.
    const hardwiredPlantInputs = plantInstances.flatMap(([id, plant]) => plant.plant.uiEvents.map(uiEvent => ({
      coupledInputEvent: prefixCoupledInputEvent(id, uiEvent.event),
      inputModelName: id,
      inputEvent: uiEvent.event,
    })));

    const hardwiredSCOutputs =
      // Expose all output events of the statechart as outputs of the Coupled DEVS
      // The MTL property checker and the Plot-component will treat these output events as signals.
      ast && [...ast.outputEvents].map(event => ({
        outputModelName: "sc",
        outputEvent: event,
        coupledOutputEvent: event,
      })) || [];

    return ast && makeTracedDEVS(makeCoupledDEVS(
      {
        sc: tracedSC2DEVS!,
        ...Object.fromEntries(plantInstances.map(([id, plant]) => [id, makeTracedDEVS(plant.plant.execution)])),
      },
      {
        // hard-wired connections:
        inputs: [
          ...hardwiredSCInputs,
          ...hardwiredPlantInputs,
        ],
        outputs: hardwiredSCOutputs,

        // the user-configurable part:
        model2Model: plantsState.conns,

      } as CoupledDEVSConns,
      ast.inputEvents.map(({event}) => event), // <-- every SC input becomes coupled input
      [...ast.outputEvents], // <-- every SC output becomes coupled output
    ));
  }, [ast, plantsState]);

  return coupledExecution;
}
