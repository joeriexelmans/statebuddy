import { AppState } from "../App.state";
import { AppStateV0 } from "./v0_types";
import { migrateToV1 } from "./v1_migrate";
import { AppStateV1 } from "./v1_types";
import { AppStateV2, VersionedAppState } from "./v2_types";

export type AppStateUnknownVersion = AppStateV0 | AppStateV1 | AppStateV2;

export function detectVersion(appState: AppStateUnknownVersion): number {
  if (Object.hasOwn(appState, "stateVersion")) {
    return (appState as VersionedAppState).stateVersion;
  }
  if (Object.hasOwn(appState, 'showKeys')) {
    return 0;
  }
  else if (Object.hasOwn(appState, 'topPanel')) {
    return 1;
  }
  throw new Error("could not determine app state version");
}

const migrations = [
  migrateToV1,
  // migrateToV2,
] as const;

export function autoMigrate(appState: AppStateUnknownVersion): AppState {
  const version = detectVersion(appState);
  console.log(`detected AppState version ${version}`);
  // @ts-ignore
  return migrations.slice(version).reduce((acc, cur) => cur(acc), appState);
}
