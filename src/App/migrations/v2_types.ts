import { EventTrigger } from "@/statecharts/label_ast";
import { DebugState, ExtTransitionTrace, FindReplaceState, MQTTState, PanelState, PlantsState, SavedTraces, ToolSelectState } from "./v1_types";

export type VersionedAppState = {
  stateVersion: number;
}

export type TraceView = {
  microSteps: boolean,
  transitions: boolean,
  autoScroll: boolean,
  plantSteps: boolean,
  height: number,
}

export type ExecutionState = {
  savedTraces: SavedTraces,
  properties: string[],
  activeProperty: number,
  plants: PlantsState,
}

// From version 2 onwards, AppState is explicit about its state version
export type AppStateV2 = VersionedAppState & {
  stateVersion: 2,

  syntax: {
    declaredInputs: EventTrigger[],
    declaredOutputs: EventTrigger[],
  },

  find: FindReplaceState,

  execution: ExecutionState,

  mqtt: MQTTState,

  view: {
    topPanel: {
      modelName: string,
      zoom: number, // <-- percentage!!! (100 means 100%)
      mouseMap: ToolSelectState,
    },
    visibility: {
      plot: boolean,
      errors: boolean,
      find: boolean,
      debug: boolean,
      keys: boolean,
      table: boolean,
    },
    trace: TraceView,
    plot: {
      visible: { [name:string]: boolean },
    },
    leftPanel: PanelState & {
      width: number,
    },
    rightPanel: PanelState & {
      width: number,
    },
    debug: DebugState,
  },
}
