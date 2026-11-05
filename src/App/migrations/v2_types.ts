import { DebugState, ExtTransitionTrace, FindReplaceStateV1, MQTTState, PanelState, PlantsState, SavedTraces, ToolSelectState } from "./v1_types";
import { VisualEditorStateV0 } from "./v0_types";
import { EventTrigger } from "@/languages/statecharts/transitionlabel/abstract_syntax";
import { TimeMode } from "../time";
import { ScrollableState } from "../Components/Scrollable";

export type VersionedAppState = {
  stateVersion: number;
}

export type TopPanelState = {
  modelName: string,
  zoom: number, // <-- percentage!!! (100 means 100%)
  mouseMap: ToolSelectState,
}

export type TraceView = {
  autoScroll: boolean,
  height: number,
}

export type InteractiveExecutionState = {
  trace?: ExtTransitionTrace, // In our app state, we only store timed input events and the total duration of the simulation. This is enough to restore the entire trace.
  time: TimeMode, // The time mode: paused at a certain point in simulated time, or real-time since a certain point in simulated + wall-clock time.
  idx: number, // Currently active item in computed trace. We need to store this information because it cannot fully be derived from the 'time' property above, because there could be multiple trace items with the same timestamp (superdense time).
};

export type ExecutionState = {
  interactive: InteractiveExecutionState,
  savedTraces: SavedTraces, // list of pair [name, trace]
  properties: string[],
  activeProperty: number,
  plants: PlantsState,
};

export type VisibilityState = {
  plot: boolean,
  errors: boolean,
  find: boolean,
  debug: boolean,
  keys: boolean,
  table: boolean,
};

export type ViewState = {
  scroll: {
    editor: ScrollableState,
    trace: ScrollableState,
  },
  topPanel: TopPanelState,
  visibility: VisibilityState,
  trace: TraceView,
  plot: {
    visible: { [name:string]: boolean },
  },
  leftPanel: PanelState & {
    scroll: ScrollableState,
    width: number,
  },
  rightPanel: PanelState & {
    scroll: ScrollableState,
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
