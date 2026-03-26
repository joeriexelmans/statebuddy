import { EventTrigger } from "@/statecharts/label_ast";
import { DebugState, FindReplaceStateV1, MQTTState, PanelState, PlantsState, SavedTraces, ToolSelectState } from "./v1_types";
import { VisualEditorStateV0 } from "./v0_types";

export type VersionedAppState = {
  stateVersion: number;
}

export type TopPanelState = {
  modelName: string,
  zoom: number, // <-- percentage!!! (100 means 100%)
  mouseMap: ToolSelectState,
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

export type VisibilityState = {
  plot: boolean,
  errors: boolean,
  find: boolean,
  debug: boolean,
  keys: boolean,
  table: boolean,
};

export type ViewState = {
  topPanel: TopPanelState,
  visibility: VisibilityState,
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
}

// JSON-serializable app state, version 2.
// From version 2 onwards, AppState is explicit about its state version
export type AppStateV2 = VersionedAppState & {
  stateVersion: 2,

  editorState: VisualEditorStateV0;

  syntax: {
    declaredInputs: EventTrigger[],
    declaredOutputs: EventTrigger[],
  },

  find: FindReplaceStateV1,

  execution: ExecutionState,

  mqtt: MQTTState,

  view: ViewState,
}
