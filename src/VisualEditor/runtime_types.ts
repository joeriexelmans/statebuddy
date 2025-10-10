export type Timestamp = number; // milliseconds since begin of simulation
export type Event = string;

export type Mode = Set<string>; // set of active states


export type Environment = ReadonlyMap<string, any>; // variable name -> value

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  // history: // TODO
}

export type BigStep = RT_Statechart & {outputEvents: string[]};

export type RaisedEvents = {
  internalEvents: string[];
  outputEvents: string[];
};

export type Timers = Map<string, number>; // transition uid -> timestamp

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],
}
