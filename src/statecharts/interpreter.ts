import { AbstractState, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition, transitionDescription, TransitionSrcTgt } from "./abstract_syntax";
import { evalExpr, execAssignment } from "./actionlang_interpreter";
import { actionLangValToText } from "./actionlang_prettyprinter";
import { Environment, FlatEnvironment, Scope } from "./environment";
import { Action, EventTrigger, TransitionLabel, Trigger } from "./label_ast";
import { BigStep, RT_Event, RT_History, RT_Microstep, TimerElapseEvent, Timers } from "./runtime_types";
import { dummyTracer, newTracer, Tracer } from "./tracer";

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
    return `(${actionLangValToText(param)})`;
  }
}

function execAction(rt: RT_Microstep, action: Action, scope: Scope, uids: string[], tracer: Tracer): RT_Microstep {
  if (action.kind === "assignment") {
    const rhsValue = evalExpr(action.rhs, rt.environment, uids);
    const environment = execAssignment(action.lhs, rhsValue, rt.environment, scope, uids, tracer);
    // const environment = rt.environment.set(action.lhs, rhs, scope);
    // trace.log(`assign ${action.lhs} = ${rhsValue}`);
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
      tracer.log(`raise internal ${raisedEvent.name}${logEventParam(raisedEvent.param)}`);
      return {
        ...rt,
        internalEvents: [...rt.internalEvents, raisedEvent],
      };
    }
    else {
      // append to output events
      tracer.log(`raise output ${raisedEvent.name}${logEventParam(raisedEvent.param)}`);
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
        trace.log("runtime error");
        throw new RuntimeError(`Missing initial state.`, [parent.uid]);
      }
      else if (parent.initial.length > 1) {
        trace.log("runtime error");
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

// Attempt to match an (input/internal) event with a transition's trigger.
// If matching succeeds, may update the environment by assigning (parts of) the event parameter to variable(s) in the LHS.
// Returns tuple: [matched (yes/no), new-environment-if-matched]
function matchEventToTrigger(
  transition: Transition, // <-- the transition
  trigger: Trigger, // <-- its trigger
  event: RT_Event | undefined, // <-- input or internal event
  environment: Environment,
): [boolean, Environment, string[]] {
  if (trigger.kind === "triggerless") {
    if (event === undefined) {
      return [true, environment, []];
    }
  }
  else if (trigger.kind === "event") {
    if (event && event.kind === "event") {
      if (trigger.event === event.name) {
        const [tempMsgs, tempTracer] = newTracer();
        if (trigger.param) {
          // assign event parameter to trigger's parameter-LHS
          try {
            environment = execAssignment(trigger.param, event.param, environment, {kind: "transition", thing: transition}, [transition.uid], tempTracer); // <-- todo: proper tracing?
          }
          catch (e) {
            if (e instanceof RuntimeError) {
              console.debug('failed to match event parameter', event.param, 'with label', trigger.param);
              return [false, environment, []];
            }
            else throw e; // only catch RuntimeError
          }
        }
        return [true, environment, tempMsgs];
      }
    }
  }
  else if (trigger.kind === "after") {
    if (event && event.kind === "timer") {
      if (event.state === transition.src.uid) {
        if (event.timeDurMs === trigger.durationMs) {
          return [true, environment, []];
        }
      }
    }
  }
  return [false, environment, []];
}

function getEnabledTransitions(rt: RT_Microstep, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart) {
  const inState = (stateLabel: string) => {
    for (const [uid, state] of statechart.uid2State.entries()) {
      if (stateDescription(state) === stateLabel) {
        return (rt.mode.has(uid));
      }
    }
  };

  const outgoing = statechart.transitions.get(sourceState.uid) || [];
  const labels = outgoing.flatMap(t =>
    t.label
      .filter(l => l.kind === "transitionLabel")
      .map(l => [t,l] as [Transition, TransitionLabel]));
  const enabled = labels.map(([transition, label]) => {
    // 1. match event <-> trigger
    const [matched, newEnvironment, msgs] = matchEventToTrigger(transition, label.trigger, event, rt.environment);
    // 2. eval guard (in throw-away environment)
    const guardEnvironment = rt.environment.set(
      "inState", inState,
      {kind: "state", thing: statechart.root});
    const isEnabled = matched && evalExpr(label.guard, guardEnvironment, [transition.uid]) as boolean;
    // console.log(label.trigger.event?.name, isEnabled);
    return [isEnabled, newEnvironment, transition, label, msgs] as const;
  });
  return enabled
    .filter(([isEnabled]) => isEnabled)
    .map(([_, newEnvironment, transition, label, msgs]) => [newEnvironment, transition, label, msgs] as const);
}

function attemptSrcState(rt: RT_Microstep, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart, trace: Tracer): RT_Microstep | undefined {
  const enabled = getEnabledTransitions(rt, sourceState, event, statechart);
  // trace(`state ${stateDescription(sourceState)} has ${enabled.length} enabled transitions`);
  if (enabled.length > 0) {
    if (enabled.length > 1) {
      trace.log("runtime error");
      throw new NonDeterminismError(`Non-determinism: multiple enabled transitions.`,
        [...enabled.map(([_, t]) => t.uid), sourceState.uid]);
    }
    const [[newEnvironment, transition, label, msgs]] = enabled; // transition to fire
    // fairness: every arena can only fire once per 'fair step'
    if (sourceState.kind === "pseudo" || allowedToFire(transition.arena, rt.firedArenas)) {
      msgs.forEach(msg => trace.log(msg));
      // fire transition!
      rt = fire({...rt, environment: newEnvironment}, transition, label.actions, trace);
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
          trace.log("runtime error");
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

function fire(rt: RT_Microstep, transition: Transition, actions: Action[], trace: Tracer): RT_Microstep {

  trace.log(`fire ${transitionDescription(transition)}`);

  rt = exitChildren(rt, transition.arena, trace.indent());

  // transition actions
  // rt = {...rt, environment: addEventParam(rt.environment, event, transition, label)};
  for (const action of actions) {
    rt = execAction(rt, action, {kind: "transition", thing: transition}, [transition.uid], trace.indent());
  }

  const tgtPath = computePath({ancestor: transition.arena, descendant: transition.tgt});
  const toEnter = resolveHistory(transition.tgt, rt.history, trace)
    .union(new Set(tgtPath.map(s=>s.uid)));

  rt = enterChildren(rt, transition.arena, toEnter, trace.indent());

  return rt;
}
