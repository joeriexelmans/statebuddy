// AppState in version 2 of StateBuddy

import { EventTrigger } from "@/statecharts/label_ast";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { Model2ModelConn } from "@/devs/coupled_devs";

export type AppStateV1 = {
  showPlot: boolean;
  findReplace: FindReplaceState;
  topPanel: TopPanelState;
  bottomPanel: BottomPanelState;
  sideBar: SideBarState;
  plot: PlotState;
  debug: DebugState;

  leftPanel: PanelState;
  rightPanel: PanelState;

  leftPanelWidth: number;
  rightPanelWidth: number;

  declaredInputs: EventTrigger[];
  declaredOutputs: EventTrigger[];
};

export type SideBarState = {
  plantsState: PlantsState;
  propertyEditor: PropertyEditorState;
  traces: TracesState;
  mqtt: MQTTState;
};

export type TopPanelState = {
  mouseMap: ToolSelectState;
  zoom: number; // <-- factor (1 means 100%)
  showKeys: boolean;
  showFindReplace: boolean;
  modelName: string;
  showDebug: boolean;
};

export type FindReplaceState = {
  findText: string;
  replaceText: string;
};

export type ToolMode = "select" | "and" | "or" | "pseudo" | "shallow" | "deep" | "transition" | "text" | "nothing";

export type ToolSelectState = {
  leftMouseMode: ToolMode; // <-- the tool that is activated by left mouse button
  middleMouseMode: ToolMode; // <-- the tool that is activated by middle mouse button
  rightMouseMode: ToolMode; // <-- the tool that is activated by right mouse button
};

export type SavedTraces = [string, ExtTransitionTrace][];

export type TracesState = {
  showMicroSteps: boolean;
  showTransitions: boolean;
  autoScroll: boolean;
  showPlantTrace: boolean;

  savedTraces: SavedTraces;
  height: number;
};

export type ExtTransitionTraceItem = {
  simtime: number;
  bagOfInputs: RaisedEvent[];
};

// A trace of only extTransitions.
// This is the minimum of information necessary to replay a trace on a DEVS component.
export type ExtTransitionTrace = {
  // sequence of timed extTransitions:
  trace: ExtTransitionTraceItem[];

  // we also store last point in simulated time, because there may still be intTransitions that happened after the last extTransition:
  lastSimTime: number;
};export type PropertyEditorState = {
  properties: string[];
  activeProperty: number;
  showTable: boolean;
};
export type MQTTTopicConfig = {
  // prefix to the topic
  prefix: string;

  // mapping MQTT subscriptions -> input events
  inputMappings: Event2MQTTMapping[];

  // mapping output events -> MQTT publications
  outputMappings: Event2MQTTMapping[];
};

export type MQTTState = {
  on: boolean;
  brokerUrl: string;
  authentication: boolean;
  user: string;
  password: string;
  seePassword: boolean;
  enableCA: boolean;
  ca: string;
  baseTopic: string;
  topics: MQTTTopicConfig[];
};

export type Event2MQTTMapping = {
  eventName: string; // e.g., doneHoist
  requestName: string; // e.g., hoist
  payload: string; // e.g., "({height}) => height"
};

export type PlantsState = {
  plants: PlantInstance[];
  nextPlantID: number;
  conns: Model2ModelConn[]; // <-- the user can configure the connections between the different components (meaning: the statechart model and the plant(s))
};

// For every plant the user instantiates, we keep the following kind of entry:
export type PlantInstance = {
  id: string; // <-- every plant instance gets a unique immutable ID
  name: string; // <-- a human-readable and editable name for the plant
  type: string; // <-- the plant type ("digital watch", "traffic light", "microwave", ...)
};

export type PanelState = {
  items: ExpandablePanelItemState[];
};

export type ExpandablePanelItemState = {
  type: PanelType;
  expanded: boolean;
};

export type BottomPanelState = {
  errorsExpanded: boolean;
};

export type PlotState = {
  visiblePlots: { [name: string]: boolean; };
};

export type PanelType =
  "state tree" |
  "input events" |
  "internal events" |
  "output events" |
  "plants" |
  "connect" |
  "mqtt" |
  "properties" |
  "execution traces";export type DebugState = {
  showBBox: boolean;
  showGrid: boolean;
  showCells: boolean;
};
