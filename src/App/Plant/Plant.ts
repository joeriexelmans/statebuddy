import { ReactNode } from "react";
import { Statechart } from "@/statecharts/abstract_syntax";
import { EventTrigger } from "@/statecharts/label_ast";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { TraceBigStep, TraceFairStep } from "@/statecharts/microstep_trace_types";
import { DEVSComponent } from "@/devs/devs";
import { sc2DEVS, SC2DEVSNonError, SC2DEVSState } from "@/devs/sc2devs";
import { RuntimeError } from "@/statecharts/interpreter";

export type PlantRenderProps<CleanStateType> = {
  state: CleanStateType,
  speed: number,
  raiseUIEvent: (e: RaisedEvent) => void,
};

// A Plant is a DEVS component that additionally:
//  - can be rendered to DOM (with React)
//  - exposes some of its internal state (basically a JSON object) (for MTL property checking)
export type Plant<StateType, EventType, CleanStateType> = {
  uiEvents: EventTrigger[];

  signals: string[]; // signal names. all signals are booleans.

  // DEVS primitives
  execution: DEVSComponent<StateType, EventType>;

  // Extra processing step on 'state', before (1) passing it to the 'render' function and also (2) for MTL property checking.
  cleanupState: (state: StateType) => CleanStateType;

  // Render as DOM
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode;
}

export type StatechartPlantSpec<CleanStateType> = {
  uiEvents: EventTrigger[],
  ast: Statechart,
  cleanupState: (state: SC2DEVSNonError) => CleanStateType,
  render: (props: PlantRenderProps<CleanStateType>) => ReactNode,
  signals: string[],
}

export function makeStatechartPlant<CleanStateType>({uiEvents, ast, cleanupState, render, signals}: StatechartPlantSpec<CleanStateType>): Plant<SC2DEVSState, RaisedEvent, CleanStateType> {
  return {
    uiEvents,
    // inputEvents: ast.inputEvents,
    // outputEvents: [...ast.outputEvents].map(e => ({kind: "event" as const, event: e})),
    execution: sc2DEVS(ast),
    cleanupState: (state: SC2DEVSState) => {
      const s = state.state;
      if (s instanceof RuntimeError) {
        console.error(s, s.highlight.map(uid => ast.uid2State.get(uid)?.comments));
        const e = new Error("unexpected runtime error in plant: " + s.message);
        throw e; // <-- crash StateBuddy
      }
      else {
        return cleanupState(s);
      }
    },
    render,
    signals,
  }
}
