import { ReactElement, ReactNode } from "react";
import { Statechart } from "@/statecharts/abstract_syntax";
import { EventTrigger } from "@/statecharts/label_ast";
import { BigStep, RaisedEvent, RT_Statechart } from "@/statecharts/runtime_types";
import { statechartExecution, TimedReactive } from "@/statecharts/timed_reactive";
import { mapsEqual, setsEqual } from "@/util/util";

export type PlantRenderProps<StateType> = {
  state: StateType,
  speed: number,
  raiseUIEvent: (e: RaisedEvent) => void,
};

export type Plant<StateType> = {
  uiEvents: EventTrigger[];

  inputEvents: EventTrigger[];
  outputEvents: EventTrigger[];

  execution: TimedReactive<StateType>;
  render: (props: PlantRenderProps<StateType>) => ReactNode;
}

// Automatically connect Statechart and Plant inputs/outputs if their event names match.
export function autoConnect(ast: Statechart, scName: string, plant: Plant<any>, plantName: string) {
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

export function exposePlantInputs(plant: Plant<any>, plantName: string, tfm = (s: string) => s) {
  const inputs = {};
  for (const i of plant.inputEvents) {
    // @ts-ignore
    inputs[tfm(i.event)] = {kind: "model", model: plantName, eventName: i.event};
  }
  return inputs
}

export type StatechartPlantSpec = {
  uiEvents: EventTrigger[],
  ast: Statechart,
  render: (props: PlantRenderProps<RT_Statechart>) => ReactNode,
}

export function makeStatechartPlant({uiEvents, ast, render}: StatechartPlantSpec): Plant<BigStep> {
  return {
    uiEvents,
    inputEvents: ast.inputEvents,
    outputEvents: [...ast.outputEvents].map(e => ({kind: "event" as const, event: e})),
    execution: statechartExecution(ast),
    render,
  }
}

export function comparePlantRenderProps(oldProps: PlantRenderProps<RT_Statechart>, newProps: PlantRenderProps<RT_Statechart>) {
  return setsEqual(oldProps.state.mode, newProps.state.mode)
    && oldProps.state.environment === newProps.state.environment // <-- could optimize this further
    && oldProps.speed === newProps.speed
    && oldProps.raiseUIEvent === newProps.raiseUIEvent
}
