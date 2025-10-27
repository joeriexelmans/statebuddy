import { Environment } from "./environment";

export type Timestamp = number; // milliseconds since begin of simulation

export type RT_Event = InputEvent | TimerElapseEvent;

export type InputEvent = {
  kind: "input",
  name: string,
  param?: any,
}

export type TimerElapseEvent = {
  kind: "timer",
  state: string,
  timeDurMs: number,
}


export type Mode = Set<string>; // set of active states

export type RT_History = Map<string, Set<string>>;

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
}

export type BigStepOutput = RT_Statechart & {
  outputEvents: RaisedEvent[],
  firedTransitions: string[],
};

// export type BigStep = {
//   inputEvent: string | null, // null if initialization
//   simtime: number,
// } & BigStepOutput;

// internal or output event
export type RaisedEvent = {
  name: string,
  param?: any,
}

export type RaisedEvents = {
  internalEvents: RaisedEvent[];
  outputEvents: RaisedEvent[];
  firedTransitions: string[]; // list of UIDs
};

// export type Timers = Map<string, number>; // transition uid -> timestamp

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],

  firedTransitions: [],
};

export type Timers = [number, TimerElapseEvent][];
