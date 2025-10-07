// modal configuration: maps child-uid to modal configuration of the child
// for OR-states, only the modal configuration of the current state is kept
// for AND-states, the modal configuration of every child is kept
// for basic states (= empty AND-states), the modal configuration is just an empty object
export type Mode = {[uid:string]: Mode};

export type Environment = ReadonlyMap<string, any>; // variable name -> value

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  // history: // TODO

  inputEvents: string[];
} & RaisedEvents;

export type RaisedEvents = {
  internalEvents: string[];
  outputEvents: string[];
};

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],
}

// export type RT_Events = {
// };
