import { AbstractState, OrState, Transition } from "../abstract_syntax";
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
  transition: Transition;
  arenaUID: string; // UID of arena of the transition
  exited: TraceExit; // the highest state in the hierarchy that was exited
  entered: TraceEnter; // the highest state in the hierarchy that was entered
  transitionActions: TraceAction[];
};

export type TraceExit = {
  state: AbstractState;
  childrenExited: TraceExit[];
  exitActions: TraceAction[];
};

export type TraceEnter = {
  state: AbstractState;
  childrenEntered: TraceEnterChildren;
  enterActions: TraceAction[];
};

export type TraceEnterChildren = TraceEnterOrStateChildren | TraceEnterAndStateChildren | TraceEnterNoChildren;

export type TraceEnterOrStateChildren = {
  kind: "or";
  which: "initial" | "target"; // is the OR-state's initial child entered, or a specific one?
  children: TraceEnter[]; // typically only one child will be entered
}

export type TraceEnterAndStateChildren = {
  kind: "and";
  children: TraceEnter[]; // all children will be entered
}

export type TraceEnterNoChildren = {
  kind: "pseudo";
  children: [], // makes code simpler if we have empty array here
}

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
  if (e.childrenEntered.kind !== "pseudo") {
    e.childrenEntered.children.forEach(child => visitEnterActions(child, fn));
  }
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

export function getEnterDefaultArrows(e: TraceEnter): string[] {
  if (e.childrenEntered.kind === "or") {
    if (e.childrenEntered.which === "initial") {
      return [
        (e.state as OrState).initial[0][0],
        ...e.childrenEntered.children.flatMap(getEnterDefaultArrows),
      ];
    }
  }
  else if (e.childrenEntered.kind === "and") {
    return e.childrenEntered.children.flatMap(getEnterDefaultArrows);
  }
  return [];
}

export function getFairStepArrows(f: TraceFairStep): string[] {
  return f.fired.flatMap(t => [
    t.transition.uid,
    ...getEnterDefaultArrows(t.entered),
  ]);
}
