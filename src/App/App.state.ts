// Most of the application state is contained herein.

import { defaultAppStateV1 } from "./migrations/v1_default";
import { AppStateV1 } from "./migrations/v1_types";

// The persistent part of the App's state (meaning, the part that is encoded in the URL hash)
// Whatever we put in here, it must be JSON-serializable.
export type AppState = AppStateV1;

export const defaultAppState = defaultAppStateV1;
