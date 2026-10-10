import { OrState, StableState } from "./abstract_syntax";
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

// The runtime state of a statechart.
export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
  timers: Timers;
};

// The runtime state of a statechart in between microsteps.
// Every microstep takes this as input and output
export type RT_Microstep = RT_Statechart & {
  simtime: number,
  internalEvents: RaisedEvent[];
  outputEvents: RaisedEvent[];
  microsteps: FiredTransition[]; // list of UIDs
  firedArenas: OrState[], // although we could also compute this from 'firedTransitions'...
}

// The runtime state of a statechart, the (timed) input that caused it, and the output events produced.
export type BigStep = RT_Statechart & {
  simtime: number,
  inputEvent?: RT_Event,
  outputEvents: RaisedEvent[],

  // We also record the transitions that fired, to highlight them in the UI:
  microsteps: FiredTransition[],
};

export type Timers = [number, TimerElapseEvent][];

// For micro-step traceability, we record all the stuff that happened when a transition was fired.
export type FiredTransition = {
  transitionUID: string,
  exited: ExitedState, // the highest state in the hierarchy that was exited
  entered: EnteredState, // the highest state in the hierarchy that was entered
  transitionActions: ExecutedAction[],
};

export type ExitedState = {
  stateUID: StableState,
  childrenExited: ExitedState[],
  exitActions: ExecutedAction[],
}

export type EnteredState = {
  stateUID: StableState,
  childrenEntered: EnteredState[],
  enterActions: ExecutedAction[],
}

export type ExecutedAction = ExecutedAssignment | ExecutedRaiseEvent;

export type ExecutedAssignment = {
  kind: "assignment",
  variableName: string,
  value: any,
}

export type ExecutedRaiseEvent = {
  kind: "raiseInternal" | "raiseOutput",
  eventName: string,
  parameter: any,
}
