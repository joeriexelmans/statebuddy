import { initialEditorState } from "../../languages/statecharts/concrete_syntax";
import { defaultScrollableState } from "../Components/Scrollable";
import { defaultDebugState, defaultFindReplaceState, defaultMQTTState } from "./v1_default";
import { defaultInteractiveExecutionState } from "./v2_default";
import { AppStateV3 } from "./v3_types";

export const defaultViewStateV3 = {
  scroll: {
    editor: defaultScrollableState,
    trace: defaultScrollableState,
  },
  visibility: {
    keys: false,
    find: false,
    plot: false,
    debug: false,
    errors: false,
    table: false,
  },
  leftPanel: {
    scroll: defaultScrollableState,
    width: 300,
    items: [
      {type: "input events" as const, expanded: true},
      {type: "internal events" as const, expanded: true},
      {type: "output events" as const, expanded: true},
    ],
  },
  rightPanel: {
    scroll: defaultScrollableState,
    width: 300,
    items: [
      {type: "execution traces" as const, expanded: true},
    ],
  },
  plot: {
    visible: {},
  },
  debug: defaultDebugState,
  trace: {
    autoScroll: true,
    height: 400,
  },
  topPanel: {
    modelName: "",
    mouseMap: {
      leftMouseMode: "select" as const,
      middleMouseMode: "nothing" as const,
      rightMouseMode: "nothing" as const,
    },
    zoom: 100,
  }
};

export const defaultExecutionStateV3 = {
  interactive: defaultInteractiveExecutionState,
  activeProperty: 0,
  properties: [],
  plants: {
    plants: [],
    nextPlantID: 0,
    conns: [],
  },
  savedTraces: [],
};

export const defaultAppStateV3: AppStateV3 = {
  stateVersion: 3,

  execution: defaultExecutionStateV3,
  mqtt: defaultMQTTState,
  find: defaultFindReplaceState,
  syntax: {
    declaredInputs: [],
    declaredOutputs: [],
    editorState: {
      history: [],
      current: initialEditorState,
      future: [],
    },
  },
  view: defaultViewStateV3,
};
