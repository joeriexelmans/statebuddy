export type VersionedAppState = {
  stateVersion: number;
}

// From version 3 onwards, AppState is explicit about its state version
export type AppStateV2 = VersionedAppState & {
  stateVersion: 2,

  
}
