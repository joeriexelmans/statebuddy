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
export type RuntimeConfiguration = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
  timers: Timers;
};

export type Initialization = {
  // the produced runtime configuration after initialization
  rtconfig: RuntimeConfiguration,

  // micro-step traceability
  enteredRoot: EnteredState,
  fairSteps: FairStep[], // <-- internal event handling
}

export type BigStep = {
  simtime: number,

  // the newly produced runtime configuration.
  rtconfig: RuntimeConfiguration,

  // micro-step traceability
  fairSteps: FairStep[],
};

export type Timers = [number, TimerElapseEvent][];

export type FairStep = {
  // the cause of the fair step: a timed event.
  event: RT_Event,

  // for traceability/debugging, the microsteps that produced the runtime configuration.
  // all raised events are also recorded here.
  fired: FiredTransition[],
};

// For micro-step traceability, we record all the stuff that happened when a transition was fired.
export type FiredTransition = {
  transitionUID: string,
  arenaUID: string, // UID of arena of the transition
  exited: ExitedState, // the highest state in the hierarchy that was exited
  entered: EnteredState, // the highest state in the hierarchy that was entered
  transitionActions: ExecutedAction[],
};

export type ExitedState = {
  stateUID: string,
  childrenExited: ExitedState[],
  exitActions: ExecutedAction[],
}

export type EnteredState = {
  stateUID: string,
  childrenEntered: EnteredState[],
  enterActions: ExecutedAction[],
}

export type ExecutedAction = 
   {kind: "assigned"} & ExecutedAssignment
 | {kind: "raisedOutput"} & RaisedEvent
 | {kind: "raisedInternal"} & RaisedEvent;

export type ExecutedAssignment = {
  // kind: "assignment",
  variableName: string,
  value: any,
}

// export type ExecutedRaiseEvent = {
//   // kind: "raiseInternal" | "raiseOutput",
//   eventName: string,
//   parameter: any,
// }

export function visitExitActions(e: ExitedState, fn: (action: ExecutedAction) => void) {
  e.childrenExited.forEach(child => visitExitActions(child, fn));
  e.exitActions.forEach(fn);
}

export function visitEnterActions(e: EnteredState, fn: (action: ExecutedAction) => void) {
  e.enterActions.forEach(fn);
  e.childrenEntered.forEach(child => visitEnterActions(child, fn));
}

export function visitTransitionActions(t: FiredTransition, fn: (action: ExecutedAction) => void) {
  visitExitActions(t.exited, fn);
  t.transitionActions.forEach(fn);
  visitEnterActions(t.entered, fn);
}

export function getRaisedEvents(fired: FiredTransition[], kind: "raisedOutput" | "raisedInternal"): RaisedEvent[] {
  const result: RaisedEvent[] = [];
  fired.forEach(f => visitTransitionActions(f, action => {
    if (action.kind === kind) {
      result.push(action)
    }
  }));
  return result;
}

function getOutputEventsFromFairSteps(fairsteps: FairStep[]) {
  return fairsteps.flatMap(step => getRaisedEvents(step.fired, "raisedOutput"));
}

export function getOutputEventsFromInit(init: Initialization) {
  let enterDefaultOutputs = [] as RaisedEvent[];
  visitEnterActions(init.enteredRoot, a => {
    if (a.kind === "raisedOutput") {
      enterDefaultOutputs.push(a);
    }
  });
  const internalEventOutputs = getOutputEventsFromFairSteps(init.fairSteps);
  return [...enterDefaultOutputs, ...internalEventOutputs];
}

export function getOutputEventsFromBigStep(bigstep: BigStep) {
  return getOutputEventsFromFairSteps(bigstep.fairSteps);
}