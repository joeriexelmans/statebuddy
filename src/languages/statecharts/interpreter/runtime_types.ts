import { RaisedEvent } from "@/languages/devs/devs_types";
import { Environment } from "./environment";

export type RT_Event = NormalEvent | TimerElapseEvent;

export type NormalEvent = RaisedEvent & {
  kind: "event",
}

export type TimerElapseEvent = {
  kind: "timer",
  state: string, // source state of timed transition
  timeDurMs: number,
}

export type Mode = Set<string>; // set of active states

export type RT_History = Map<string, Set<string>>;

export type Timers = [number, TimerElapseEvent][];

// The runtime state of a statechart.
export type RuntimeConfiguration = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
  timers: Timers;
};
