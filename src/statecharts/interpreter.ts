import { AbstractState, computeArena, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition, transitionDescription, TransitionSrcTgt } from "./abstract_syntax";
import { evalExpr } from "./actionlang_interpreter";
import { Environment, FlatEnvironment } from "./environment";
import { Action, EventTrigger, TransitionLabel } from "./label_ast";
import { BigStep, RT_Event, RT_History, RT_Microstep, TimerElapseEvent, Timers } from "./runtime_types";

export class RuntimeError extends Error {
  highlight: string[];
  constructor(message: string, highlight: string[]) {
    super(message);
    this.highlight = highlight;
  }
}

export class NonDeterminismError extends RuntimeError {}

const initialEnv = new Map<string, any>([
  ["_timers", []],
  ["_log", (str: string) => console.log(str)],
]);

// const initialScopedEnvironment = new ScopedEnvironment({env: initialEnv, children: {}});
const intiialFlatEnvironment = new FlatEnvironment(initialEnv);

const emptyMicrostep = {
  internalEvents: [],
  outputEvents: [],
  firedTransitions: [],
  firedArenas: [],
}

export function initialize(ast: Statechart): BigStep {
  const rt = enterState({
    simtime: 0,
    environment: intiialFlatEnvironment,
    mode: new Set(),
    history: new Map(),
    timers: [],
    ...emptyMicrostep,
  }, ast.root);
  return handleInternalEvents(rt, ast);
}

function execAction(rt: RT_Microstep, action: Action, uids: string[]): RT_Microstep {
  if (action.kind === "assignment") {
    const rhs = evalExpr(action.rhs, rt.environment, uids);
    const environment = rt.environment.set(action.lhs, rhs);
    return {
      ...rt,
      environment,
    };
  }
  else if (action.kind === "raise") {
    const raisedEvent = {
      name: action.event,
      param: action.param && evalExpr(action.param, rt.environment),
    };
    if (action.event.startsWith('_')) {
      // append to internal events
      return {
        ...rt,
        internalEvents: [...rt.internalEvents, raisedEvent],
      };
    }
    else {
      // append to output events
      return {
        ...rt,
        outputEvents: [...rt.outputEvents, raisedEvent],
      }
    }
  }
  throw new Error("should never reach here");
}

function enterState(rt: RT_Microstep, state: TransitionSrcTgt, toEnter: Set<string> = new Set()): RT_Microstep {
  // add to mode
  rt = {...rt, mode: new Set([...rt.mode, state.uid])};

  // entry actions
  for (const action of state.entryActions) {
    rt = execAction(rt, action, [state.uid]);
  }

  if (state.kind !== "pseudo") {
    // schedule timers
    const newTimers = [
      ...rt.timers,
      ...state.timers.map(timeOffset => {
        const futureSimTime = rt.simtime + timeOffset;
        return [futureSimTime, {kind: "timer", state: state.uid, timeDurMs: timeOffset}] as [number, TimerElapseEvent];
      }),
    ];
    newTimers.sort((a,b) => a[0] - b[0]); // earliest timers come first
    rt = {...rt, timers: newTimers};

    // enter children
    rt = enterChildren(rt, state, toEnter);
  }

  return rt;
}

function exitState(rt: RT_Microstep, state: TransitionSrcTgt): RT_Microstep {
  if (state.kind !== "pseudo") {
    // exit children first
    rt = exitChildren(rt, state);

    // cancel timers
    const newTimers = rt.timers.filter(([_, {state: s}]) => s !== state.uid);
    rt = {...rt, timers: newTimers};
  }

  // exit actions
  for (const action of state.exitActions) {
    (rt = execAction(rt, action, [state.uid]));
  }

  // remove from mode
  rt = {...rt, mode: new Set([...rt.mode].filter(s => s !== state.uid))};
  return rt;
}

// recursively enter the given state's children
// AND-states: all children are entered.
// OR-states: if one of the children occurs in 'toEnter', this child will be chosen. if not, then the default child is entered.
function enterChildren(rt: RT_Microstep, parent: ConcreteState, toEnter: Set<string> = new Set()): RT_Microstep {
  // enter children...
  if (parent.kind === "and") {
    // every child must be entered
    for (const child of parent.children) {
      rt = enterState(rt, child, toEnter);
    }
  }
  else if (parent.kind === "or") {
    // only one child can be entered
    const childToEnter = parent.children.filter(child => toEnter.has(child.uid));
    if (childToEnter.length === 1) {
      // good
      const child = childToEnter[0];
      rt = enterState(rt, child, toEnter);
    }
    else if (childToEnter.length === 0) {
      // also good, enter default child
      if (parent.initial.length === 0) {
        throw new RuntimeError(`Missing initial state.`, [parent.uid]);
      }
      else if (parent.initial.length > 1) {
        throw new NonDeterminismError(`Non-determinism: multiple initial states.`, [parent.uid, ...parent.initial.map(i => i[0]), parent.uid]);
      }
      const [[_, child]] = parent.initial;
      rt = enterState(rt, child, toEnter);
    }
    else {
      throw new Error("can only enter one child of an OR-state, stupid!");
    }
  }

  return rt;
}

function recordDeepHistory(rt: RT_Microstep, state: ConcreteState, h: HistoryState): RT_Microstep {
  // horribly inefficient (i don't care)
  const history = new Map(rt.history);
  history.set(h.uid,
    getDescendants(state)
      .difference(new Set([state.uid]))
      .intersection(rt.mode));
  return {...rt, history};
}

// exit the given state's active descendants
export function exitChildren(rt: RT_Microstep, parent: ConcreteState): RT_Microstep {
  // exit all active children...
  if (parent.kind === "and") {
    // record history...
    for (const h of parent.history) {
      if (h.kind === "shallow") {
        const history = new Map(rt.history);
        // record the shallow history of every child (because recording the history of the AND-state itself would be redundant)
        history.set(h.uid, new Set([
          ...parent.children.map(child => child.uid),
          ...parent.children.flatMap(child =>
            child.children
              .filter(child => rt.mode.has(child.uid))
              .map(child => child.uid))]));
        rt = {...rt, history};
      }
      else { // deep history
        rt = recordDeepHistory(rt, parent, h);
      }
    }
    // every child is exited
    for (const child of parent.children) {
      rt = exitState(rt, child);
    }
  }
  else if (parent.kind === "or") {
    // record history...
    for (const h of parent.history) {
      if (h.kind === "shallow") {
        const history = new Map(rt.history);
        history.set(h.uid, new Set(parent.children
          .filter(child => rt.mode.has(child.uid))
          .map(child => child.uid)));
        rt = {...rt, history};
      }
      else { // deep history
        rt = recordDeepHistory(rt, parent, h);
      }
    }
    // exit active child
    for (const child of parent.children) {
      if (rt.mode.has(child.uid)) {
      rt = exitState(rt, child);
      }
    }
  }

  return rt;
}

function allowedToFire(arena: OrState, firedArenas: OrState[]) {
  for (const firedArena of firedArenas) {
    if (isOverlapping(arena, firedArena))
      return false;
  }
  return true;
}

function addEventParam(environment: Environment, event: RT_Event | undefined, label: TransitionLabel) {
  if (event && event.kind === "event" && event.param !== undefined) {
    const varName = (label.trigger as EventTrigger).paramName as string;
    return environment.newVar(varName, event.param);
  }
  else {
    return environment;
  }
}

function getEnabledTransitions(rt: RT_Microstep, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart): [Transition, TransitionLabel][] {
  const outgoing = statechart.transitions.get(sourceState.uid) || [];
  const labels = outgoing.flatMap(t =>
    t.label
      .filter(l => l.kind === "transitionLabel")
      .map(l => [t,l] as [Transition, TransitionLabel]));

  let triggered: [Transition, TransitionLabel][];
  if (event !== undefined) {
    if (event.kind === "event") {
      // get transitions triggered by event
      triggered = labels.filter(([_t,l]) =>
        l.trigger.kind === "event" && l.trigger.event === event.name);
    }
    else {
      // get transitions triggered by timeout
      triggered = labels.filter(([_t,l]) =>
        l.trigger.kind === "after" && sourceState.uid === event.state && l.trigger.durationMs === event.timeDurMs);
    }
  }
  else {
    // pseudo-state transition...
    triggered = labels.filter(([_t,l]) => l.trigger.kind === "triggerless");
  }
  // eval guard...
  const inState = (stateLabel: string) => {
    for (const [uid, state] of statechart.uid2State.entries()) {
      if (stateDescription(state) === stateLabel) {
        return (rt.mode.has(uid));
      }
    }
  };
  const guardEnvironment = rt.environment.set("inState", inState);
  const enabled = triggered.filter(([t,l]) => evalExpr(l.guard, addEventParam(guardEnvironment, event, l), [t.uid]));
  return enabled;
}

function attemptSrcState(rt: RT_Microstep, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart): RT_Microstep | undefined {
  const enabled = getEnabledTransitions(rt, sourceState, event, statechart);
  if (enabled.length > 0) {
    if (enabled.length > 1) {
      throw new NonDeterminismError(`Non-determinism: multiple enabled transitions.`,
        [...enabled.map(([t]) => t.uid), sourceState.uid]);
    }
    const [[transition, label]] = enabled; // transition to fire
    const arena = computeArena(transition.src, transition.tgt);
    // fairness: every arena can only fire once per 'fair step'
    if (sourceState.kind === "pseudo" || allowedToFire(arena, rt.firedArenas)) {
      // fire transition!
      rt = fire(rt, transition, event, statechart.transitions, label, arena);
      rt = {...rt,
        firedTransitions: [...rt.firedTransitions, transition.uid],
        firedArenas: [...rt.firedArenas, arena],
      };

      // if there is any pseudo-state in the modal configuration, immediately fire any enabled outgoing transitions of that state:
      while (true) {
        const activePseudo = [...rt.mode]
          .map(s => statechart.uid2State.get(s))
          .find(s => s?.kind === "pseudo");
        if (!activePseudo) {
          break;
        }
        const newRt = attemptSrcState(rt, activePseudo, undefined, statechart);
        if (newRt === undefined) {
          throw new RuntimeError("Stuck in choice-state.", [activePseudo.uid]);
        }
        rt = newRt;
      }
      return rt;
    }
  }
}

// A fair step is a response to one (input|internal) event, where possibly multiple transitions are made as long as their arenas do not overlap. A reasonably accurate and more intuitive explanation is that every orthogonal region is allowed to fire at most one transition.
function fairStep(rt: RT_Microstep, event: RT_Event, statechart: Statechart, activeParent: StableState): RT_Microstep {
  for (const state of activeParent.children) {
    if (rt.mode.has(state.uid)) {
      const didFire = attemptSrcState(rt, state, event, statechart);
      if (didFire) {
        rt = didFire;
      }
      else {
        // no enabled outgoing transitions, try the children:
        rt = fairStep(rt, event, statechart, state);
      }
    }
  }
  return rt;
}

export function makeBigStep(rt: BigStep, event: RT_Event, statechart: Statechart): BigStep {
  const microstep = fairStep({...rt,
    firedArenas: [],
    firedTransitions: [],
    internalEvents: [],
    outputEvents: [],
  }, event, statechart, statechart.root);
  return {
    ...handleInternalEvents(microstep, statechart),
    inputEvent: event,
  };
}

function handleInternalEvents(microstep: RT_Microstep, statechart: Statechart): BigStep {
  while (microstep.internalEvents.length > 0) {
    const [nextEvent, ...remainingEvents] = microstep.internalEvents;
    microstep = fairStep(
      {...microstep, internalEvents: remainingEvents},
      {kind: "event", ...nextEvent},
      statechart,
      statechart.root);
  }
  return {
    simtime: microstep.simtime,
    mode: microstep.mode,
    environment: microstep.environment,
    history: microstep.history,
    timers: microstep.timers,
    outputEvents: microstep.outputEvents,
    firedTransitions: microstep.firedTransitions,
  };
}

function resolveHistory(tgt: AbstractState, history: RT_History): Set<string> {
  if (tgt.kind === "shallow" || tgt.kind === "deep") {
    const toEnter = history.get(tgt.uid) || new Set();
    return toEnter;
  }
  else {
    const toEnter = new Set([tgt.uid]);
    return toEnter;
  }
}

function fire(rt: RT_Microstep, t: Transition, event: RT_Event | undefined, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState): RT_Microstep {

  console.log('firing:', transitionDescription(t));

  rt = exitChildren(rt, arena);

  // transition actions
  rt = {...rt, environment: addEventParam(rt.environment, event, label)};
  for (const action of label.actions) {
    rt = execAction(rt, action, [t.uid]);
  }

  const tgtPath = computePath({ancestor: arena, descendant: t.tgt});
  const toEnter = resolveHistory(t.tgt, rt.history)
    .union(new Set(tgtPath.map(s=>s.uid)));

  rt = enterChildren(rt, arena, toEnter);

  return rt;
}
