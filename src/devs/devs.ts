// An abstract interface for timed reactive discrete event systems somewhat similar but not equal to DEVS (https://en.wikipedia.org/wiki/DEVS).
// Differences from DEVS:
//   - time is kept as absolute simulated time (since beginning of simulation), not relative to the last transition
//   - events are lists (ordered) instead of bags (unordered)
// The only reason for deviating from DEVS is that Statechart runtime configurations store future timeouts as absolute timestamps (since beginning of simulation). It is just easier that way.
export type DEVSComponent<StateType, EventType> = {
  initial: () => StateType,
  timeAdvance: (runtimeState: StateType) => number,
  intTransition: (runtimeState: StateType) => [EventType[], StateType],
  extTransition: (simTime: number, runtimeState: StateType, bagOfInputs: EventType[]) => StateType,

  // in/out event names:
  inputs: string[],
  outputs: string[],
}
