import { createContext } from "react";

// For real-time simulation, our app needs to know "the time" of the app's environment.
// By default, the current system time is used.
// But it can be overridden to make the app itself run in a simulated environment.
export const NowContext = createContext(() => Date.now());
