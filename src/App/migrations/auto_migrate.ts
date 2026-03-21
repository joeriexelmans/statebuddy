import { AppState } from "../App.state";
import { AppStateV0 } from "./v0_types";
import { migrateToV1 } from "./v1_migrate";
import { AppStateV1 } from "./v1_types";
import { migrateToV2 } from "./v2_migrate";
import { AppStateV2, VersionedAppState } from "./v2_types";

export type AppStateUnknownVersion = AppStateV0 | AppStateV1 | AppStateV2;

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
  migrateToV1,
  migrateToV2,
] as const;

export function autoMigrate(appState: AppStateUnknownVersion): AppState {
  const version = detectVersion(appState);
  console.log(`detected app state version v${version}`);
  // @ts-ignore
  return migrations.slice(version).reduce((acc, migrate, i) => {
    console.log(`migrating app state v${version+i} -> v${version+i+1}`);
    // @ts-ignore
    return migrate(acc)
  }, appState);
}
