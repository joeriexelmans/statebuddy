// Most of the application state is contained herein.

import { defaultAppStateV3 } from "./migrations/v3_default";
import { AppStateV3 } from "./migrations/v3_types";

// The persistent part of the App's state (meaning, the part that is encoded in the URL hash)
// Whatever we put in here, it must be JSON-serializable.
export type AppState = AppStateV3;

export const defaultAppState = defaultAppStateV3;
