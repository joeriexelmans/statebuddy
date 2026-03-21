import { AppStateV1, DebugState, MQTTState, SideBarState, ToolSelectState, TracesState } from "./v1_types";

export const defaultToolSelectState: ToolSelectState = {
  leftMouseMode: 'select',
  middleMouseMode: 'nothing',
  rightMouseMode: 'and',
};

export const defaultFindReplaceState = {
  findText: "",
  replaceText: "",
};

export const defaultTopPanelState = {
  mouseMap: defaultToolSelectState,
  zoom: 1,
  showKeys: true,
  showFindReplace: false,
  modelName: "",
  showDebug: false,
};

export const defaultPropertyEditorState = {
  properties: [],
  activeProperty: 0,
  showTable: false,
};

export const defaultMQTTState: MQTTState = {
  on: false,
  brokerUrl: "ws://localhost:9001",
  authentication: false,
  user: "",
  password: "",
  seePassword: false,
  enableCA: false,
  ca: "",
  baseTopic: "",
  topics: [],
};

export const defaultTracesState: TracesState = {
  autoScroll: true,
  showMicroSteps: false,
  showTransitions: false,
  showPlantTrace: false,

  savedTraces: [],
  height: 300,
};

export const defaultPlantsState = {
  plants: [],
  nextPlantID: 0,
  conns: [],
};

export const defaultSideBarState: SideBarState = {
  plantsState: defaultPlantsState,
  propertyEditor: defaultPropertyEditorState,
  traces: defaultTracesState,
  mqtt: defaultMQTTState,
};

export const defaultBottomPanelState = {
  errorsExpanded: false,
};

export const defaultPlotState = {
  visiblePlots: {},
};

export const defaultDebugState: DebugState = {
  showBBox: false,
  showGrid: false,
  showCells: false,
};

export const defaultAppStateV1: AppStateV1 = {
  showPlot: false,
  findReplace: defaultFindReplaceState,
  topPanel: defaultTopPanelState,
  sideBar: defaultSideBarState,
  plot: defaultPlotState,
  bottomPanel: defaultBottomPanelState,
  debug: defaultDebugState,
  leftPanel: {
    items: [
      { type: "input events", expanded: true },
      { type: "internal events", expanded: true },
      { type: "output events", expanded: true },
    ],
  },
  rightPanel: {
    items: [
      { type: "execution traces", expanded: true },
    ],
  },

  leftPanelWidth: 200,
  rightPanelWidth: 300,

  declaredInputs: [],
  declaredOutputs: [],
};
