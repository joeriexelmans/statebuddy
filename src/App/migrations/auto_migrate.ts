import { AppState } from "../App.state";
import { SerializableSelection } from "../VisualEditor/VisualEditor.state";
import { AppStateV0 } from "./v0_types";
import { v0_to_v1 } from "./v0_to_v1";
import { AppStateV1 } from "./v1_types";
import { v1_to_v2 } from "./v1_to_v2";
import { AppStateV2, VersionedAppState } from "./v2_types";
import { v2_to_v3 } from "./v2_to_v3";
import { AppStateV3 } from "./v3_types";
import { myPureDeepAssign } from "../../util/util";
import { defaultAppStateV3 } from "./v3_default";

export type AppStateUnknownVersion = AppStateV0 | AppStateV1 | AppStateV2 | AppStateV3;

export function detectVersion(appState: AppStateUnknownVersion): number {
  if (Object.hasOwn(appState, "stateVersion")) {
    return (appState as VersionedAppState).stateVersion;
  }
  else if (Object.hasOwn(appState, 'topPanel')) {
    return 1;
  }
  else if (Object.hasOwn(appState, 'showKeys')) {
    return 0;
  }
  throw new Error("could not determine app state version");
}

const migrations = [
  v0_to_v1,
  v1_to_v2,
  v2_to_v3,
] as const;

export function autoMigrate(appState: AppStateUnknownVersion): AppState {
  const version = detectVersion(appState);
  console.log(`detected app state version v${version}`);
  // @ts-ignore
  const v3 = migrations.slice(version).reduce((acc, migrate, i) => {
    console.log(`migrating app state v${version+i} -> v${version+i+1}`);
    // @ts-ignore
    return migrate(acc)
  }, appState);

  // finally, add all missing fields
  return myPureDeepAssign(defaultAppStateV3, v3);
}
