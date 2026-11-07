import { DeepPartial } from "@/util/deep_partial";
import { myPureDeepAssign } from "@/util/util";
import { defaultAppStateV2 as defaultAppStateV3 } from "./v2_default";
import { AppStateV3 } from "./v3_types";
import { AppStateV4 } from "./v4_types";

export function v3_to_v4(state: DeepPartial<AppStateV3>): DeepPartial<AppStateV4> {
  const {syntax: {declaredInputs, declaredOutputs, editorState}, ...fullV3} = myPureDeepAssign(defaultAppStateV3, state) as AppStateV3;

  const fullV4 = {
    ...fullV3,

    syntax: {
      declaredInputs: declaredInputs.map(i => ({
        event: i.event,
        paramTxt: "",
        savedParams: [],
      })),
      declaredOutputs: declaredOutputs.map(o => o.event),
      editorState,
    },
    stateVersion: 4,
  } as DeepPartial<AppStateV4>;

  return fullV4
}
