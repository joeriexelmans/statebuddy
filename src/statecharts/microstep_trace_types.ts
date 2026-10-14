import { RuntimeConfiguration, RT_Event, RaisedEvent } from "./runtime_types";


export type TraceInit = {
  // the produced runtime configuration after initialization
  rtconfig: RuntimeConfiguration;

  // micro-step traceability
  enteredRoot: TraceEnter;
  fairSteps: TraceFairStep[]; // <-- internal event handling
};

export type TraceBigStep = {
  simtime: number;

  // the newly produced runtime configuration.
  rtconfig: RuntimeConfiguration;

  // micro-step traceability
  fairSteps: TraceFairStep[];
};


export type TraceFairStep = {
  // the cause of the fair step: a timed event.
  event: RT_Event;

  // for traceability/debugging, the microsteps that produced the runtime configuration.
  // all raised events are also recorded here.
  fired: TraceSmallStep[];
};

// For micro-step traceability, we record all the stuff that happened when a transition was fired.
export type TraceSmallStep = {
  transitionUID: string;
  arenaUID: string; // UID of arena of the transition
  exited: TraceExit; // the highest state in the hierarchy that was exited
  entered: TraceEnter; // the highest state in the hierarchy that was entered
  transitionActions: TraceAction[];
};

export type TraceExit = {
  stateUID: string;
  childrenExited: TraceExit[];
  exitActions: TraceAction[];
};

export type TraceEnter = {
  stateUID: string;
  childrenEntered: TraceEnter[];
  enterActions: TraceAction[];
};

export type TraceAction = (
  { kind: "assigned"; } & TraceAssign) | TraceRaisedEvent;

export type TraceRaisedEvent = (
  { kind: "raisedOutput"; } & RaisedEvent) | ({ kind: "raisedInternal"; } & RaisedEvent);

export type TraceAssign = {
  variableName: string;
  value: any;
};

export function visitExitActions(e: TraceExit, fn: (action: TraceAction) => void) {
  e.childrenExited.forEach(child => visitExitActions(child, fn));
  e.exitActions.forEach(fn);
}

export function visitEnterActions(e: TraceEnter, fn: (action: TraceAction) => void) {
  e.enterActions.forEach(fn);
  e.childrenEntered.forEach(child => visitEnterActions(child, fn));
}

export function visitTransitionActions(t: TraceSmallStep, fn: (action: TraceAction) => void) {
  visitExitActions(t.exited, fn);
  t.transitionActions.forEach(fn);
  visitEnterActions(t.entered, fn);
}

export function getRaisedEvents(fired: TraceSmallStep[], kind: "raisedOutput" | "raisedInternal"): TraceRaisedEvent[] {
  const result: TraceRaisedEvent[] = [];
  fired.forEach(f => visitTransitionActions(f, action => {
    if (action.kind === kind) {
      result.push(action);
    }
  }));
  return result;
}
