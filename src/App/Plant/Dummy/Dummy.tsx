import { Plant } from "../Plant";
import { TimedReactive } from "@/statecharts/timed_reactive";

export const dummyExecution: TimedReactive<null> = {
  initial: () => [[], null],
  timeAdvance: () => Infinity,
  intTransition: () => { throw new Error("dummy never makes intTransition"); },
  extTransition: () => [[], null],
};

export const DummyPlant: Plant<null> = {
  inputEvents: [],
  outputEvents: [],
  execution: dummyExecution,
  render: (props) => <></>,
}
