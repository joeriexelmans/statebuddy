import { initialEditorState } from "../../statecharts/concrete_syntax";
import { defaultDebugState, defaultFindReplaceState, defaultMQTTState } from "./v1_default";
import { AppStateV3 } from "./v3_types";

export const defaultAppStateV3 = {
  stateVersion: 3,

  execution: {
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
    editorState: {
      history: [],
      current: initialEditorState,
      future: [],
    },
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
} as AppStateV3;
