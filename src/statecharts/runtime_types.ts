import { OrState } from "./abstract_syntax";
import { Environment } from "./environment";

// export type Timestamp = number; // milliseconds since begin of simulation

export type RaisedEvent = {
  name: string,
  param?: any,
};

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

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
  timers: Timers;
};

// every microstep takes this as input and output
export type RT_Microstep = RT_Statechart & {
  simtime: number,
  internalEvents: RaisedEvent[];
  outputEvents: RaisedEvent[];
  firedTransitions: string[]; // list of UIDs
  firedArenas: OrState[], // although we could also compute this from 'firedTransitions'...
}

export type BigStep = RT_Statechart & {
  simtime: number,
  inputEvent?: RT_Event,
  outputEvents: RaisedEvent[],

  // we also record the transitions that fired, to highlight them in the UI:
  firedTransitions: string[],
};

export type Timers = [number, TimerElapseEvent][];
