import { EventTrigger } from "../../statecharts/label_ast";
import { UndoState } from "../../hooks/useUndo";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { FindReplaceState, MQTTState, ToolSelectState, PanelState, DebugState } from "./v1_types";
import { ExecutionState, TraceView } from "./v2_types";

// In V3 of our app state, we switch to CBOR (instead of JSON).
// This has important benefits:
//  - transparent round-trip of Map and Set types (no need for manual conversion to JSON in our 'Selection' type)
//  - supports structural sharing = enabler for efficient serializing our edit history. Even supports cyclical references! (object identity preserving round-trip)
//  - higher efficiency than JSON + deflate
export type AppStateV3 = {
  stateVersion: 3,

  syntax: {
    declaredInputs: EventTrigger[],
    declaredOutputs: EventTrigger[],
    editorState: UndoState<VisualEditorState>; // <-- CBOR serialization allows efficient history encoding :)
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
};
