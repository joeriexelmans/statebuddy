import { initialEditorState } from "@/languages/statecharts/concrete_syntax";
import { AppStateV4 } from "./v4_types";
import { defaultFindReplaceState, defaultMQTTState } from "./v1_default";
import { defaultExecutionStateV3, defaultViewStateV3 } from "./v3_default";

export const defaultAppStateV4: AppStateV4 = {
  stateVersion: 4,
  syntax: {
    declaredInputs: [],
    declaredOutputs: [],
    editorState: {
      history: [],
      current: initialEditorState,
      future: [],
    },
  },
  find: defaultFindReplaceState,
  execution: defaultExecutionStateV3,
  mqtt: defaultMQTTState,
  view: defaultViewStateV3,
};
