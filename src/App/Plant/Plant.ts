import { ReactNode } from "react";
import { Statechart } from "@/statecharts/abstract_syntax";
import { EventTrigger } from "@/statecharts/label_ast";
import { BigStep, RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSComponent } from "@/devs/devs";
import { sc2DEVS, SC2DEVSState } from "@/devs/sc2devs";

export type PlantRenderProps<CleanStateType> = {
  state: CleanStateType,
  speed: number,
  raiseUIEvent: (e: RaisedEvent) => void,
};

// A Plant is a DEVS component that additionally:
//  - can be rendered to DOM (with React)
//  - exposes some of its internal state (basically a JSON object) (for MTL property checking)
export type Plant<StateType, CleanStateType> = {
  uiEvents: EventTrigger[];

  signals: string[]; // signal names. all signals are booleans.

  // DEVS primitives
  execution: DEVSComponent<StateType>;

  // Extra processing step on 'state', before (1) passing it to the 'render' function and also (2) for MTL property checking.
  cleanupState: (state: StateType) => CleanStateType;

  // Render as DOM
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode;
}

// // Automatically connect Statechart and Plant inputs/outputs if their event names match.
// export function autoConnect(ast: Statechart, scName: string, plant: Plant<any, any>, plantName: string) {
//   const outputs = {
//     [scName]: {},
//     [plantName]: {},
//   }
//   for (const o of ast.outputEvents) {
//     const plantInputEvent = plant.inputEvents.find(e => e.event === o)
//     if (plantInputEvent) {
//       // @ts-ignore
//       outputs[scName][o] = {kind: "model", model: plantName, eventName: plantInputEvent.event};
//     }
//   }
//   for (const o of plant.outputEvents) {
//     const scInputEvent = ast.inputEvents.find(e => e.event === o.event);
//     if (scInputEvent) {
//       // @ts-ignore
//       outputs[plantName][o.event] = {kind: "model", model: scName, eventName: scInputEvent.event};
//     }
//   }
//   return outputs;
// }

// export function exposePlantInputs(plant: Plant<any, any>, plantName: string, tfm = (s: string) => s) {
//   const inputs = {};
//   for (const i of plant.inputEvents) {
//     // @ts-ignore
//     inputs[tfm(i.event)] = {kind: "model", model: plantName, eventName: i.event};
//   }
//   return inputs
// }

export type StatechartPlantSpec<CleanStateType> = {
  uiEvents: EventTrigger[],
  ast: Statechart,
  cleanupState: (state: BigStep) => CleanStateType,
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode,
  signals: string[],
}

export function makeStatechartPlant<CleanStateType>({uiEvents, ast, cleanupState, render, signals}: StatechartPlantSpec<CleanStateType>): Plant<SC2DEVSState, CleanStateType> {
  return {
    uiEvents,
    // inputEvents: ast.inputEvents,
    // outputEvents: [...ast.outputEvents].map(e => ({kind: "event" as const, event: e})),
    execution: sc2DEVS(ast),
    cleanupState: (state: SC2DEVSState) => {
      return cleanupState(state.bigstep);
    },
    render,
    signals,
  }
}

// export function comparePlantRenderProps(oldProps: PlantRenderProps<RT_Statechart>, newProps: PlantRenderProps<RT_Statechart>) {
//   return setsEqual(oldProps.state.mode, newProps.state.mode)
//     && oldProps.state.environment === newProps.state.environment // <-- could optimize this further
//     && oldProps.speed === newProps.speed
//     && oldProps.raiseUIEvent === newProps.raiseUIEvent
// }
