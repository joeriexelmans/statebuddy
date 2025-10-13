export type Timestamp = number; // milliseconds since begin of simulation
export type Event = string;

export type Mode = Set<string>; // set of active states


export type Environment = ReadonlyMap<string, any>; // variable name -> value

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  // history: // TODO
}

export type BigStepOutput = RT_Statechart & {
  outputEvents: string[],
};

export type BigStep = {
  inputEvent: string | null, // null if initialization
  simtime: number,
} & BigStepOutput;


export type RaisedEvents = {
  internalEvents: string[];
  outputEvents: string[];
};

// export type Timers = Map<string, number>; // transition uid -> timestamp

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],
};

export type TimerElapseEvent = { state: string; timeDurMs: number; };
export type Timers = [number, TimerElapseEvent][];

