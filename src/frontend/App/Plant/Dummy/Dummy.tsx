import { EventTrigger } from "@/languages/statecharts/text/abstract_syntax";
import { Plant } from "../Plant";
import { DEVSComponent } from "@/languages/devs/devs_types";

export const dummyExecution: DEVSComponent<{}, EventTrigger> = {
  initial: () => [[], {}],
  timeAdvance: () => Infinity,
  intTransition: () => { throw new Error("dummy never makes intTransition"); },
  extTransition: () => [[], {}],
  inputs: [],
  outputs: [],
};

export const dummyPlant: Plant<{}, EventTrigger, {}> = {
  uiEvents: [],
  // inputEvents: [],
  // outputEvents: [],
  execution: dummyExecution,
  cleanupState: ({}) => ({}),
  render: ({}) => <></>,
  signals: [],
};
