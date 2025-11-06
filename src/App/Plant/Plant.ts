import { ReactNode } from "react";
import { Statechart } from "@/statecharts/abstract_syntax";
import { EventTrigger } from "@/statecharts/label_ast";
import { BigStep, RaisedEvent, RT_Statechart } from "@/statecharts/runtime_types";
import { statechartExecution, TimedReactive } from "@/statecharts/timed_reactive";
import { setsEqual } from "@/util/util";

export type PlantRenderProps<StateType> = {
  state: StateType,
  speed: number,
  raiseUIEvent: (e: RaisedEvent) => void,
};

export type Plant<StateType, CleanStateType> = {
  uiEvents: EventTrigger[];

  inputEvents: EventTrigger[];
  outputEvents: EventTrigger[];

  execution: TimedReactive<StateType>;
  cleanupState: (state: StateType) => CleanStateType;
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode;
}

// Automatically connect Statechart and Plant inputs/outputs if their event names match.
export function autoConnect(ast: Statechart, scName: string, plant: Plant<any, any>, plantName: string) {
  const outputs = {
    [scName]: {},
    [plantName]: {},
  }
  for (const o of ast.outputEvents) {
    const plantInputEvent = plant.inputEvents.find(e => e.event === o)
    if (plantInputEvent) {
      // @ts-ignore
      outputs[scName][o] = {kind: "model", model: plantName, eventName: plantInputEvent.event};
    }
  }
  for (const o of plant.outputEvents) {
    const scInputEvent = ast.inputEvents.find(e => e.event === o.event);
    if (scInputEvent) {
      // @ts-ignore
      outputs[plantName][o.event] = {kind: "model", model: scName, eventName: scInputEvent.event};
    }
  }
  return outputs;
}

export function exposePlantInputs(plant: Plant<any, any>, plantName: string, tfm = (s: string) => s) {
  const inputs = {};
  for (const i of plant.inputEvents) {
    // @ts-ignore
    inputs[tfm(i.event)] = {kind: "model", model: plantName, eventName: i.event};
  }
  return inputs
}

export type StatechartPlantSpec<CleanStateType> = {
  uiEvents: EventTrigger[],
  ast: Statechart,
  cleanupState: (rtConfig: RT_Statechart) => CleanStateType,
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode,
}

export function makeStatechartPlant<CleanStateType>({uiEvents, ast, cleanupState, render}: StatechartPlantSpec<CleanStateType>): Plant<BigStep, CleanStateType> {
  return {
    uiEvents,
    inputEvents: ast.inputEvents,
    outputEvents: [...ast.outputEvents].map(e => ({kind: "event" as const, event: e})),
    execution: statechartExecution(ast),
    cleanupState,
    render,
  }
}

// export function comparePlantRenderProps(oldProps: PlantRenderProps<RT_Statechart>, newProps: PlantRenderProps<RT_Statechart>) {
//   return setsEqual(oldProps.state.mode, newProps.state.mode)
//     && oldProps.state.environment === newProps.state.environment // <-- could optimize this further
//     && oldProps.speed === newProps.speed
//     && oldProps.raiseUIEvent === newProps.raiseUIEvent
// }
