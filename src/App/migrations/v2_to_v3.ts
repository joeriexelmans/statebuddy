import { DeepPartial } from "../../util/deep_partial";
import { myPureDeepAssign } from "../../util/util";
import { deserializeSelection } from "../VisualEditor/VisualEditor.state";
import { defaultAppStateV2 } from "./v2_default";
import { AppStateV2 } from "./v2_types";
import { AppStateV3 } from "./v3_types";

export function v2_to_v3(state: DeepPartial<AppStateV2>): DeepPartial<AppStateV3> {
  const {editorState: {selection, ...editorState}, ...fullV2} = myPureDeepAssign(defaultAppStateV2, state) as AppStateV2;

  const migrated = {
    ...fullV2,

    // not much changed, except we 'move' the editor state under 'syntax'.
    syntax: {
      ...fullV2.syntax,
      editorState: {
        current: {
          ...editorState,
          selection: deserializeSelection(selection),
        },
      },
    },
    stateVersion: 3,
  } as DeepPartial<AppStateV3>;

  return migrated
}
