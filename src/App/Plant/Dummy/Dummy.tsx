import { Plant } from "../Plant";
import { DEVSComponent } from "@/devs/devs";

export const dummyExecution: DEVSComponent<{}> = {
  initial: () => [[], {}],
  timeAdvance: () => Infinity,
  intTransition: () => { throw new Error("dummy never makes intTransition"); },
  extTransition: () => [[], {}],
  inputs: [],
  outputs: [],
};

export const dummyPlant: Plant<{}, {}> = {
  uiEvents: [],
  // inputEvents: [],
  // outputEvents: [],
  execution: dummyExecution,
  cleanupState: ({}) => ({}),
  render: ({}) => <></>,
  signals: [],
};
