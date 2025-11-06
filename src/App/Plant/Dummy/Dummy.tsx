import { Plant } from "../Plant";
import { TimedReactive } from "@/statecharts/timed_reactive";

export const dummyExecution: TimedReactive<{}> = {
  initial: () => [[], {}],
  timeAdvance: () => Infinity,
  intTransition: () => { throw new Error("dummy never makes intTransition"); },
  extTransition: () => [[], {}],
};

export const dummyPlant: Plant<{}, {}> = {
  uiEvents: [],
  inputEvents: [],
  outputEvents: [],
  execution: dummyExecution,
  cleanupState: ({}) => ({}),
  render: ({}) => <></>,
  signals: [],
};
