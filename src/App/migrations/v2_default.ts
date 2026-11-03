import { initialEditorState } from "../../languages/statecharts/concrete_syntax";
import { Selection } from "../VisualEditor/VisualEditor.state";
import { defaultDebugState, defaultFindReplaceState, defaultMQTTState } from "./v1_default";
import { AppStateV2 } from "./v2_types";

export const defaultInteractiveExecutionState = {
  trace: undefined,
  time: {
    kind: "paused",
    simtime: 0,
  },
  idx: 0,
};

export const defaultAppStateV2 = {
  stateVersion: 2,

  editorState: {
    ...initialEditorState,
    selection: [],
  },
  execution: {
    interactive: defaultInteractiveExecutionState,
    activeProperty: 0,
    properties: [],
    plants: {
      plants: [],
      nextPlantID: 0,
      conns: [],
    },
    savedTraces: [],
  },
  mqtt: defaultMQTTState,
  find: defaultFindReplaceState,
  syntax: {
    declaredInputs: [],
    declaredOutputs: [],
  },
  view: {
    visibility: {
      keys: false,
      find: false,
      plot: false,
      debug: false,
      errors: false,
      table: false,
    },
    leftPanel: {
      width: 300,
      items: [
        {type: "input events", expanded: true},
        {type: "internal events", expanded: true},
        {type: "output events", expanded: true},
      ],
    },
    rightPanel: {
      width: 300,
      items: [
        {type: "execution traces", expanded: true},
      ],
    },
    plot: {
      visible: {},
    },
    debug: defaultDebugState,
    trace: {
      autoScroll: true,
      height: 400,
      microSteps: true,
      plantSteps: true,
      transitions: false,
    },
    topPanel: {
      modelName: "",
      mouseMap: {
        leftMouseMode: "select",
        middleMouseMode: "nothing",
        rightMouseMode: "nothing",
      },
      zoom: 100,
    }
  }
} as AppStateV2;
