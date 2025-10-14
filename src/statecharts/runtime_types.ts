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

export type Environment = ReadonlyMap<string, any>; // variable name -> value

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  // history: // TODO
}

export type BigStepOutput = RT_Statechart & {
  outputEvents: RaisedEvent[],
};

export type BigStep = {
  inputEvent: string | null, // null if initialization
  simtime: number,
} & BigStepOutput;

// internal or output event
export type RaisedEvent = {
  name: string,
  param?: any,
}


export type RaisedEvents = {
  internalEvents: RaisedEvent[];
  outputEvents: RaisedEvent[];
};

// export type Timers = Map<string, number>; // transition uid -> timestamp

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],
};

export type Timers = [number, TimerElapseEvent][];
