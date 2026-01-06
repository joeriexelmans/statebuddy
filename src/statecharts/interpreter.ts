import { AbstractState, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition, transitionDescription, TransitionSrcTgt } from "./abstract_syntax";
import { evalExpr } from "./actionlang_interpreter";
import { Environment, FlatEnvironment, Scope } from "./environment";
import { Action, EventTrigger, TransitionLabel } from "./label_ast";
import { BigStep, RT_Event, RT_History, RT_Microstep, TimerElapseEvent, Timers } from "./runtime_types";
import { Tracer } from "./tracer";

export class RuntimeError extends Error {
  highlight: string[];
  constructor(message: string, highlight: string[]) {
    super(message);
    this.highlight = highlight;
  }
}

export class NonDeterminismError extends RuntimeError {}

const initialEnv = new Map<string, any>([
  ["_log", (str: string) => console.log(str)],
]);

const initialFlatEnvironment = new FlatEnvironment(initialEnv);

const emptyMicrostep = {
  internalEvents: [],
  outputEvents: [],
  firedTransitions: [],
  firedArenas: [],
}

export function initialize(ast: Statechart, trace: Tracer): BigStep {
  trace.log('init')
  const subTrace = trace.indent();
  const rt = enterState({
    simtime: 0,
    environment: initialFlatEnvironment,
    mode: new Set(),
    history: new Map(),
    timers: [],
    ...emptyMicrostep,
  }, ast.root, new Set(), subTrace);
  return handleInternalEvents(rt, ast, subTrace);
}

function logEventParam(param: any) {
  if (param === undefined) {
    return '';
  }
  else {
    return `:${param}`;
  }
}

function execAction(rt: RT_Microstep, action: Action, scope: Scope, uids: string[], trace: Tracer): RT_Microstep {
  if (action.kind === "assignment") {
    const rhs = evalExpr(action.rhs, rt.environment, uids);
    const environment = rt.environment.set(action.lhs, rhs, scope);
    trace.log(`assign ${action.lhs} = ${rhs}`);
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
      trace.log(`raise internal ${raisedEvent.name}${logEventParam(raisedEvent.param)}`);
      return {
        ...rt,
        internalEvents: [...rt.internalEvents, raisedEvent],
      };
    }
    else {
      // append to output events
      trace.log(`raise output ${raisedEvent.name}${logEventParam(raisedEvent.param)}`);
      return {
        ...rt,
        outputEvents: [...rt.outputEvents, raisedEvent],
      }
    }
  }
  throw new Error("should never reach here");
}

function enterState(rt: RT_Microstep, state: TransitionSrcTgt, toEnter: Set<string> = new Set(), trace: Tracer): RT_Microstep {
  // add to mode
  rt = {...rt, mode: new Set([...rt.mode, state.uid])};

  trace.log(`enter ${stateDescription(state)}`);

  // entry actions
  for (const action of state.entryActions) {
    rt = execAction(rt, action, {kind: "state", thing: state}, [state.uid], trace.indent());
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
    rt = enterChildren(rt, state, toEnter, trace.indent());
  }

  return rt;
}

function exitState(rt: RT_Microstep, state: TransitionSrcTgt, trace: Tracer): RT_Microstep {
  if (state.kind !== "pseudo") {
    rt = recordHistory(rt, state, trace);

    // exit children first
    rt = exitChildren(rt, state, trace.indent());

    // cancel timers
    const newTimers = rt.timers.filter(([_, {state: s}]) => s !== state.uid);
    rt = {...rt, timers: newTimers};
  }

  // exit actions
  for (const action of state.exitActions) {
    (rt = execAction(rt, action, {kind: "state", thing: state}, [state.uid], trace.indent()));
  }

  trace.log(`exit ${stateDescription(state)}`);

  // remove from mode
  rt = {...rt, mode: new Set([...rt.mode].filter(s => s !== state.uid))};
  return rt;
}

// recursively enter the given state's children
// AND-states: all children are entered.
// OR-states: if one of the children occurs in 'toEnter', this child will be chosen. if not, then the default child is entered.
function enterChildren(rt: RT_Microstep, parent: ConcreteState, toEnter: Set<string> = new Set(), trace: Tracer): RT_Microstep {
  // enter children...
  if (parent.kind === "and") {
    // every child must be entered
    for (const child of parent.children) {
      rt = enterState(rt, child, toEnter, trace);
    }
  }
  else if (parent.kind === "or") {
    // only one child can be entered
    const childToEnter = parent.children.filter(child => toEnter.has(child.uid));
    if (childToEnter.length === 1) {
      // good
      const child = childToEnter[0];
      rt = enterState(rt, child, toEnter, trace);
    }
    else if (childToEnter.length === 0) {
      // also good, enter default child
      if (parent.initial.length === 0) {
        throw new RuntimeError(`Missing initial state.`, [parent.uid]);
      }
      else if (parent.initial.length > 1) {
        throw new NonDeterminismError(`Non-determinism: multiple initial states.`, [parent.uid, ...parent.initial.map(i => i[0]), parent.uid]);
      }
      const [[arrow, child]] = parent.initial;
      rt = enterState(rt, child, toEnter, trace);
      rt = {
        ...rt,
        firedTransitions: [...rt.firedTransitions, arrow],  
      }
    }
    else {
      throw new Error("can only enter one child of an OR-state, stupid!");
    }
  }

  return rt;
}

function logHistoryValue(v: Set<string>) {
  return '{' + [...v].join(', ') + '}';
}

function recordDeepHistory(rt: RT_Microstep, state: ConcreteState, h: HistoryState, trace: Tracer): RT_Microstep {
  // horribly inefficient (i don't care)
  const history = new Map(rt.history);
  const historyValue = getDescendants(state)
    .difference(new Set([state.uid]))
    .intersection(rt.mode);
  trace.log(`record deep history of ${stateDescription(state)} = ${logHistoryValue(historyValue)}`);
  history.set(h.uid, historyValue);
  return {...rt, history};
}

function recordHistory(rt: RT_Microstep, state: ConcreteState, trace: Tracer): RT_Microstep {
  if (state.kind === "and") {
    for (const h of state.history) {
      if (h.kind === "shallow") {
        const history = new Map(rt.history);
        // record the shallow history of every child (because recording the history of the AND-state itself would be redundant)
        const historyValue = new Set([
          ...state.children.map(child => child.uid),
          ...state.children.flatMap(child =>
            child.kind !== "pseudo" &&
              child.children
                .filter(child => rt.mode.has(child.uid))
                .map(child => child.uid)
              || [])]);
        trace.log(`record shallow history of ${stateDescription(state)} = ${logHistoryValue(historyValue)}`);
        history.set(h.uid, historyValue);
        rt = {...rt, history};
      }
      else { // deep history
        rt = recordDeepHistory(rt, state, h, trace);
      }
    }
  }
  else if (state.kind === "or") {
    // record history...
    for (const h of state.history) {
      if (h.kind === "shallow") {
        const history = new Map(rt.history);
        const historyValue = new Set(state.children
          .filter(child => rt.mode.has(child.uid))
          .map(child => child.uid));
        trace.log(`record shallow history of ${stateDescription(state)} = ${logHistoryValue(historyValue)}`);
        history.set(h.uid, historyValue);
        rt = {...rt, history};
      }
      else { // deep history
        rt = recordDeepHistory(rt, state, h, trace);
      }
    }
  }
  return rt;
}

// exit the given state's active descendants
export function exitChildren(rt: RT_Microstep, parent: ConcreteState, trace: Tracer): RT_Microstep {
  // exit all active children...
  if (parent.kind === "and") {
    // every child is exited
    for (const child of parent.children) {
      rt = exitState(rt, child, trace);
    }
  }
  else if (parent.kind === "or") {
    // exit active child
    for (const child of parent.children) {
      if (rt.mode.has(child.uid)) {
      rt = exitState(rt, child, trace);
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

function addEventParam(environment: Environment, event: RT_Event | undefined, transition: Transition, label: TransitionLabel) {
  if (event && event.kind === "event" && event.param !== undefined) {
    const varName = (label.trigger as EventTrigger).paramName as string;
    if (varName) {
      const result = environment.newVar(varName, event.param, {kind: "transition", thing: transition});
      return result;
    }
  }
  return environment;
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
  const guardEnvironment = rt.environment.set("inState", inState,
    // we throw away the guard-environment after evaluating the guard so we don't actually pollute our environment.
    {kind: "state", thing: statechart.root});
  const enabled = triggered.filter(([t,l]) => evalExpr(l.guard, addEventParam(guardEnvironment, event, t, l), [t.uid]));
  return enabled;
}

function attemptSrcState(rt: RT_Microstep, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart, trace: Tracer): RT_Microstep | undefined {
  const enabled = getEnabledTransitions(rt, sourceState, event, statechart);
  // trace(`state ${stateDescription(sourceState)} has ${enabled.length} enabled transitions`);
  if (enabled.length > 0) {
    if (enabled.length > 1) {
      throw new NonDeterminismError(`Non-determinism: multiple enabled transitions.`,
        [...enabled.map(([t]) => t.uid), sourceState.uid]);
    }
    const [[transition, label]] = enabled; // transition to fire
    // fairness: every arena can only fire once per 'fair step'
    if (sourceState.kind === "pseudo" || allowedToFire(transition.arena, rt.firedArenas)) {
      // fire transition!
      rt = fire(rt, transition, event, statechart.transitions, label, trace);
      rt = {...rt,
        firedTransitions: [...rt.firedTransitions, transition.uid],
        firedArenas: [...rt.firedArenas, transition.arena],
      };

      // if there is any pseudo-state in the modal configuration, immediately fire any enabled outgoing transitions of that state:
      while (true) {
        const activePseudo = [...rt.mode]
          .map(s => statechart.uid2State.get(s))
          .find(s => s?.kind === "pseudo");
        if (!activePseudo) {
          break;
        }
        const newRt = attemptSrcState(rt, activePseudo, undefined, statechart, trace);
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
function fairStep(rt: RT_Microstep, event: RT_Event, statechart: Statechart, activeParent: StableState, trace: Tracer): RT_Microstep {
  for (const state of activeParent.children) {
    if (rt.mode.has(state.uid)) {
      const didFire = attemptSrcState(rt, state, event, statechart, trace);
      if (didFire) {
        rt = didFire;
      }
      else {
        // no enabled outgoing transitions, try the children:
        if (state.kind !== "pseudo") {
          rt = fairStep(rt, event, statechart, state, trace);
        }
      }
    }
  }
  return rt;
}

export function makeBigStep(rt: BigStep, event: RT_Event, statechart: Statechart, trace: Tracer): BigStep {
  if (event.kind === "timer") {
    trace.log(`timer`);
  }
  else {
    trace.log(`input ${event.name}${logEventParam(event.param)}`);
  }
  const microstep = fairStep({...rt,
    firedArenas: [],
    firedTransitions: [],
    internalEvents: [],
    outputEvents: [],
  }, event, statechart, statechart.root, trace.indent());
  const result = {
    ...handleInternalEvents(microstep, statechart, trace),
    inputEvent: event,
  };
  return result;
}

function handleInternalEvents(microstep: RT_Microstep, statechart: Statechart, trace: Tracer): BigStep {
  while (microstep.internalEvents.length > 0) {
    const [nextEvent, ...remainingEvents] = microstep.internalEvents;
    trace.log(`internal ${nextEvent.name}${logEventParam(nextEvent.param)}`);
    microstep = fairStep(
      {
        ...microstep,
        internalEvents: remainingEvents,
        firedArenas: [], // <-- reset
      },
      {kind: "event", ...nextEvent},
      statechart,
      statechart.root,
      trace.indent());
  }
  return microstep;
  //  {
  //   simtime: microstep.simtime,
  //   mode: microstep.mode,
  //   environment: microstep.environment,
  //   history: microstep.history,
  //   timers: microstep.timers,
  //   outputEvents: microstep.outputEvents,
  //   firedTransitions: microstep.firedTransitions,
  // };
}

function resolveHistory(tgt: AbstractState, history: RT_History, trace: Tracer): Set<string> {
  if (tgt.kind === "shallow" || tgt.kind === "deep") {
    const toEnter = history.get(tgt.uid) || new Set();
    trace.log(`restore ${tgt.kind} history of ${stateDescription(tgt.parent!)} = ${logHistoryValue(toEnter)}`);
    return toEnter;
  }
  else {
    const toEnter = new Set([tgt.uid]);
    return toEnter;
  }
}

function fire(rt: RT_Microstep, transition: Transition, event: RT_Event | undefined, ts: Map<string, Transition[]>, label: TransitionLabel, trace: Tracer): RT_Microstep {

  trace.log(`fire ${transitionDescription(transition)}`);

  rt = exitChildren(rt, transition.arena, trace.indent());

  // transition actions
  rt = {...rt, environment: addEventParam(rt.environment, event, transition, label)};
  for (const action of label.actions) {
    rt = execAction(rt, action, {kind: "transition", thing: transition}, [transition.uid], trace.indent());
  }

  const tgtPath = computePath({ancestor: transition.arena, descendant: transition.tgt});
  const toEnter = resolveHistory(transition.tgt, rt.history, trace)
    .union(new Set(tgtPath.map(s=>s.uid)));

  rt = enterChildren(rt, transition.arena, toEnter, trace.indent());

  return rt;
}
