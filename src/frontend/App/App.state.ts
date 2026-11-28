// Most of the application state is contained herein.

import { defaultAppStateV4 } from "./migrations/v4_default";
import { AppStateV4 } from "./migrations/v4_types";

// The persistent part of the App's state (meaning, the part that is encoded in the URL hash)
// Whatever we put in here, it must be JSON-serializable.
export type AppState = AppStateV4;

export const defaultAppState = defaultAppStateV4;
