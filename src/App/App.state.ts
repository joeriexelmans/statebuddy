// Most of the application state is contained herein.

import { defaultAppStateV2 } from "./migrations/v2_default";
import { AppStateV2 } from "./migrations/v2_types";

// The persistent part of the App's state (meaning, the part that is encoded in the URL hash)
// Whatever we put in here, it must be JSON-serializable.
export type AppState = AppStateV2;

export const defaultAppState = defaultAppStateV2;
