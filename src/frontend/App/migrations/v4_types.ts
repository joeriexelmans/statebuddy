import { UndoState } from "@/hooks/useUndo";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { FindReplaceStateV1, MQTTState } from "./v1_types";
import { ExecutionState, ViewState } from "./v2_types";

export type DeclaredInput = {
  event: string,
  paramTxt: string,
  savedParams: string[],
};

export type SyntaxStateV4 = {
  declaredInputs: DeclaredInput[],
  declaredOutputs: string[],
  editorState: UndoState<VisualEditorState>; // <-- CBOR serialization allows efficient history encoding :)
};

export type AppStateV4 = {
  stateVersion: 4,

  syntax: SyntaxStateV4,

  find: FindReplaceStateV1,

  execution: ExecutionState,

  mqtt: MQTTState,

  view: ViewState,
};
