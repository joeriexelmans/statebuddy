import { AbstractState, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition,  TransitionSrcTgt } from "./abstract_syntax";
import { evalExpr, execAssignment } from "./actionlang_interpreter";
import { actionLangValToText } from "./actionlang_prettyprinter";
import { Environment, Scope, ScopedEnvironment } from "./environment";
import { Action,  TransitionLabel, Trigger } from "./label_ast";
import { FairStep, EnteredState, ExecutedAction, ExecutedAssignment, ExitedState, getRaisedEvents, Initialization, Mode, RT_Event, RT_History, RuntimeConfiguration, TimerElapseEvent, Timers, FiredTransition, BigStep, visitEnterActions, RaisedEvent } from "./runtime_types";

export class RuntimeError extends Error {
  highlight: string[];
  constructor(message: string, highlight: string[]) {
    super(message);
    this.highlight = highlight;
  }
}

export class NonDeterminismError extends RuntimeError {}

const _log = (str: string) => {
  console.log(str); return str;
}

// const initialFlatEnvironment = new FlatEnvironment(new Map<string, any>([["_log", _log]]));

const initialScopedEnvironment = (root: OrState) => new ScopedEnvironment(new Map([["root", new Map([["_log", _log]])]]), new Map([["root", {kind: "state", thing: root}]]));

export function initialize(ast: Statechart): Initialization {
  let enteredRoot, rtconfig;
  [rtconfig, enteredRoot] = enterState(0, {
    environment: initialScopedEnvironment(ast.root),
    mode: new Set(),
    history: new Map(),
    timers: [],
  }, ast.root, new Set());
  const internal = [] as RaisedEvent[];
  visitEnterActions(enteredRoot, action => {
    if (action.kind === "raisedInternal") {
      internal.push(action);
    }
  });
  let fairSteps;
  [fairSteps, rtconfig] = handleInternalEvents(0, rtconfig, internal, ast);
  return {
    rtconfig,
    enteredRoot,
    fairSteps
  };
}

function logEventParam(param: any) {
  if (param === undefined) {
    return '';
  }
  else {
    return `(${actionLangValToText(param)})`;
  }
}

function execAction(env: Environment, action: Action, scope: Scope, uids: string[]): [Environment, ExecutedAction[]] {
  if (action.kind === "assignment") {
    const rhsValue = evalExpr(action.rhs, env, scope, uids);
    let actions;
    [env, actions] = execAssignment(action.lhs, rhsValue, env, scope, uids);
    return [env, actions.map(a => ({kind: "assigned", ...a}))];
  }
  else if (action.kind === "raise") {
    const raisedEvent = {
      name: action.event,
      param: action.param && evalExpr(action.param, env, scope, uids),
    };
    if (action.event.startsWith('_')) {
      // append to internal events
      return [env, [{kind: "raisedInternal", ...raisedEvent}]];
    }
    else {
      // append to output events
      return [env, [{kind: "raisedOutput", ...raisedEvent}]];
    }
  }
  throw new Error("should never reach here");
}

function enterState(simtime: number, {environment, mode, timers, ...rest}: RuntimeConfiguration, state: TransitionSrcTgt, toEnter: Set<string> = new Set()): [RuntimeConfiguration, EnteredState] {
  // add to mode
  mode = new Set([...mode, state.uid]);

  // entry actions
  let enterActions: ExecutedAction[] = [];
  for (const action of state.entryActions) {
    let as;
    [environment, as] = execAction(environment, action, {kind: "state", thing: state}, [state.uid]);
    enterActions = [...enterActions, ...as];
  }

  let rt = {environment, mode, timers, ...rest};

  let childrenEntered: EnteredState[] = [];
  if (state.kind !== "pseudo") {
    // schedule timers
    timers = [
      ...timers,
      ...state.timers.map(timeOffset => {
        const futureSimTime = simtime + timeOffset;
        return [futureSimTime, {kind: "timer", state: state.uid, timeDurMs: timeOffset}] as [number, TimerElapseEvent];
      }),
    ];
    timers.sort((a,b) => a[0] - b[0]); // earliest timers come first

    // enter children
    ([rt, childrenEntered] = enterChildren(simtime, {
      ...rt,
      timers,
    }, state, toEnter));
  }

  return [rt, {
    stateUID: state.uid,
    enterActions,
    childrenEntered,
  }];
}

function exitState(rt: RuntimeConfiguration, state: TransitionSrcTgt): [RuntimeConfiguration, ExitedState] {
  let childrenExited = [] as ExitedState[];
  if (state.kind !== "pseudo") {
    const newHistory = recordHistory(rt.history, rt.mode, state);

    rt = {...rt, history: newHistory};

    // exit children first
    [rt, childrenExited] = exitChildren(rt, state);

    // cancel timers
    const newTimers = rt.timers.filter(([_, {state: s}]) => s !== state.uid);
    rt = {...rt, timers: newTimers};
  }

  const scope = {kind: "state" as const, thing: state};

  // exit actions
  let env = rt.environment;
  let exitActions = [];
  for (const action of state.exitActions) {
    let as;
    ([env, as] = execAction(env, action, scope, [state.uid]));
    exitActions.push(...as);
  }
  // all variables that were declared within the scope of our exited state are deleted
  env = deleteVariables(env, scope);

  // remove from mode
  rt = {...rt, mode: new Set([...rt.mode].filter(s => s !== state.uid))};
  return [rt, {
    stateUID: state.uid,
    exitActions,
    childrenExited,
  }];
}

// recursively enter the given state's children
// AND-states: all children are entered.
// OR-states: if one of the children occurs in 'toEnter', this child will be chosen. if not, then the default child is entered.
function enterChildren(simtime: number, rt: RuntimeConfiguration, parent: ConcreteState, toEnter: Set<string> = new Set()): [RuntimeConfiguration, EnteredState[]] {
  // enter children...
  if (parent.kind === "and") {
    // every child must be entered
    return parent.children.reduce(([rt, entered], child) => {
      const [newRt, newlyEntered] = enterState(simtime, rt, child, toEnter);
      return [newRt, [...entered, newlyEntered]];
    }, [rt, [] as EnteredState[]] as const);
  }
  else if (parent.kind === "or") {
    // only one child can be entered
    const childToEnter = parent.children.filter(child => toEnter.has(child.uid));
    let entered;
    if (childToEnter.length === 1) {
      // good
      const child = childToEnter[0];
      [rt, entered] = enterState(simtime, rt, child, toEnter);
    }
    else if (childToEnter.length === 0) {
      // also good, enter default child
      if (parent.initial.length === 0) {
        // tracer.log("runtime error");
        throw new RuntimeError(`Missing initial state.`, [parent.uid]);
      }
      else if (parent.initial.length > 1) {
        // tracer.log("runtime error");
        throw new NonDeterminismError(`Non-determinism: multiple initial states.`, [parent.uid, ...parent.initial.map(i => i[0]), parent.uid]);
      }
      const [[arrow, child]] = parent.initial;
      let entered;
      [rt, entered] = enterState(simtime, rt, child, toEnter);
    }
    else {
      throw new Error("can only enter one child of an OR-state, stupid!");
    }
    return [rt, [entered!]];
  }
  throw new Error("should never reach here");
}

function logHistoryValue(v: Set<string>) {
  return '{' + [...v].join(', ') + '}';
}

function recordDeepHistory(history: RT_History, mode: Mode, exitedState: ConcreteState, h: HistoryState): RT_History {
  // horribly inefficient (i don't care)
  history = new Map(history);
  const historyValue = getDescendants(exitedState)
    .difference(new Set([exitedState.uid]))
    .intersection(mode);
  // tracer.log(`record deep history of ${stateDescription(state)} = ${logHistoryValue(historyValue)}`);
  history.set(h.uid, historyValue);
  return history;
}

function recordHistory(history: RT_History, mode: Mode, exitedState: ConcreteState): RT_History {
  if (exitedState.kind === "and") {
    for (const h of exitedState.history) {
      if (h.kind === "shallow") {
        history = new Map(history);
        // record the shallow history of every child (because recording the history of the AND-state itself would be redundant)
        const historyValue = new Set([
          ...exitedState.children.map(child => child.uid),
          ...exitedState.children.flatMap(child =>
            child.kind !== "pseudo" &&
              child.children
                .filter(child => mode.has(child.uid))
                .map(child => child.uid)
              || [])]);
        // tracer.log(`record shallow history of ${stateDescription(state)} = ${logHistoryValue(historyValue)}`);
        history.set(h.uid, historyValue);
        // rt = {...rt, history};
      }
      else { // deep history
        history = recordDeepHistory(history, mode, exitedState, h);
      }
    }
  }
  else if (exitedState.kind === "or") {
    // record history...
    for (const h of exitedState.history) {
      if (h.kind === "shallow") {
        history = new Map(history);
        const historyValue = new Set(exitedState.children
          .filter(child => mode.has(child.uid))
          .map(child => child.uid));
        // tracer.log(`record shallow history of ${stateDescription(exitedState)} = ${logHistoryValue(historyValue)}`);
        history.set(h.uid, historyValue);
      }
      else { // deep history
        history = recordDeepHistory(history, mode, exitedState, h);
      }
    }
  }
  return history;
}

// exit the given state's active descendants
export function exitChildren(rt: RuntimeConfiguration, parent: ConcreteState): [RuntimeConfiguration, ExitedState[]] {
  // exit all active children...
  if (parent.kind === "and") {
    // every child is exited
    return parent.children.reduce(([rt, exitedStates], child) => {
      const [newRt, exitedState] = exitState(rt, child);
      return [newRt, [...exitedStates, exitedState]];
    }, [rt, [] as ExitedState[]]);
  }
  else if (parent.kind === "or") {
    // exit active child
    for (const child of parent.children) {
      if (rt.mode.has(child.uid)) {
        const [newRt, exitedState] = exitState(rt, child);
        return [newRt, [exitedState]];
      }
    }
    console.warn(`exited OR-state ${parent.uid} has no active children -- illegal configuration`);
  }
  // throw new Error("should never reach here");
  return [rt, []];
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
): [boolean, Environment, ExecutedAssignment[]] {
  if (trigger.kind === "triggerless") {
    if (event === undefined) {
      return [true, environment, []];
    }
  }
  else if (trigger.kind === "event") {
    if (event && event.kind === "event") {
      if (trigger.event === event.name) {
        // const [tempMsgs, tempTracer] = newTracer();
        let actions: ExecutedAssignment[] = [];
        if (trigger.param) {
          // assign event parameter to trigger's parameter-LHS
          try {
            [environment, actions] = execAssignment(trigger.param, event.param, environment, {kind: "transition", thing: transition}, [transition.uid]); // <-- todo: proper tracing?
          }
          catch (e) {
            if (e instanceof RuntimeError) {
              // console.debug('failed to match event parameter', event.param, 'with label', trigger.param);
              return [false, environment, []];
            }
            else throw e; // only catch RuntimeError
          }
        }
        return [true, environment, actions];
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

function getEnabledTransitions(mode: Mode, environment: Environment, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart) {
  // generate 'inState'-macro (this function can be called from within a guard condition)
  const inState = (stateLabel: string) => {
    for (const [uid, state] of statechart.uid2State.entries()) {
      if (stateDescription(state) === stateLabel) {
        return (mode.has(uid));
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
    const [matched, newEnvironment] = matchEventToTrigger(transition, label.trigger, event, environment);
    // 2. eval guard (in throw-away environment that possibly extends newEnvironment)
    const guardEnvironment = newEnvironment.set(
      "inState", inState,
      {kind: "state", thing: statechart.root});    
    const isEnabled = matched && evalExpr(label.guard, guardEnvironment, {kind: "transition", thing: transition}, [transition.uid]) as boolean;
    // console.log(label.trigger.event?.name, isEnabled);
    return [isEnabled, newEnvironment, transition, label] as const;
  });
  return enabled
    .filter(([isEnabled]) => isEnabled)
    .map(([_, newEnvironment, transition, label]) => [newEnvironment, transition, label] as const);
}

// Attempt to make ONE outgoing transition from the given source state.
// Returns a new runtime configuration if a transition was made. Returns 'undefined' if no transition could be made.
// If the target of the transition is a pseudo-state, then within this same call, transitions will keep firing until a stable state is reached.
function attemptSrcState(simtime: number, alreadyFired: FiredTransition[], rtconfig: RuntimeConfiguration, sourceState: AbstractState, event: RT_Event | undefined, statechart: Statechart): [FiredTransition[], RuntimeConfiguration] | undefined {
  const enabled = getEnabledTransitions(rtconfig.mode, rtconfig.environment, sourceState, event, statechart);
  if (enabled.length > 0) {
    if (enabled.length > 1) {
      throw new NonDeterminismError(`Non-determinism: multiple enabled transitions.`,
        [...enabled.map(([_, t]) => t.uid), sourceState.uid]);
    }
    const [[newEnvironment, transition, label]] = enabled; // transition to fire
    // fairness: every arena can only fire once per 'fair step'
    if (sourceState.kind === "pseudo" || allowedToFire(transition.arena, alreadyFired.map(f => statechart.uid2State.get(f.arenaUID) as OrState))) {
      // fire transition!
      const [newRtConfig, fired] = fire(simtime, {...rtconfig, environment: newEnvironment}, transition, label);
      alreadyFired = [...alreadyFired, fired];
      return fireUntilStable(simtime, alreadyFired, newRtConfig, statechart);
    }
  }
}

function fireUntilStable(simtime: number, alreadyFired: FiredTransition[], rtconfig: RuntimeConfiguration, statechart: Statechart): [FiredTransition[], RuntimeConfiguration] {
  while (true) {
    const activePseudo = [...rtconfig.mode]
        .map(s => statechart.uid2State.get(s))
        .find(s => s?.kind === "pseudo");
    if (!activePseudo) {
      break;
    }
    const didFire = attemptSrcState(simtime, alreadyFired, rtconfig, activePseudo, undefined, statechart);
    if (!didFire) {
      throw new RuntimeError("Stuck in choice-state.", [activePseudo.uid]);
    }
    [alreadyFired, rtconfig] = didFire;
  }
  return [alreadyFired, rtconfig] as const;
}

// A fair step is a response to one (input|internal) event, where possibly multiple transitions are made as long as their arenas do not overlap. A reasonably accurate and more intuitive explanation is that every orthogonal region is allowed to fire at most one transition.
// This function will attempt to fire outgoing transitions of 'activeParent's children, and recursively, the children of the children. This corresponds to 'parent first' priority semantics.
function fairStep(simtime: number, rtconfig: RuntimeConfiguration, event: RT_Event, statechart: Statechart, activeParent: StableState): [FiredTransition[], RuntimeConfiguration] {
  let alreadyFired = [] as FiredTransition[];
  function addStep([fired, cfg]: [FiredTransition[], RuntimeConfiguration]) {
    alreadyFired = [...alreadyFired, ...fired];
    rtconfig = cfg;
  }
  for (const state of activeParent.children) {
    if (rtconfig.mode.has(state.uid)) {
      const didFire = attemptSrcState(simtime, alreadyFired, rtconfig, state, event, statechart);
      if (didFire) {
        addStep(didFire);
      }
      else {
        // no enabled outgoing transitions, try the children:
        if (state.kind !== "pseudo") {
          addStep(fairStep(simtime, rtconfig, event, statechart, state));
        }
      }
    }
  }
  return [alreadyFired, rtconfig];
}

// Perform a 'big step', AKA run-to-completion (RTC) step. A big step is an atomic response to an input event or timer elapse.
export function makeBigStep(rtconfig: RuntimeConfiguration, simtime: number, event: RT_Event, statechart: Statechart): BigStep {
  let fired;
  [fired, rtconfig] = fairStep(simtime, rtconfig, event, statechart, statechart.root);
  let steps;
  [steps, rtconfig] = handleInternalEvents(simtime, rtconfig, getRaisedEvents(fired, "raisedInternal"), statechart);
  return {
    simtime,
    rtconfig,
    fairSteps: [{event, fired}, ...steps],
  };
}

// handle internal events after handling input event or after entering default state(s).
export function handleInternalEvents(simtime: number, rtconfig: RuntimeConfiguration, internalEvents: RaisedEvent[], statechart: Statechart): [FairStep[], RuntimeConfiguration] {
  const result = [];
  const remaining = [...internalEvents]; // defensive copy
  while (internalEvents.length > 0) {
    const next = remaining.shift()!; // get next event
    const event = {kind: "event" as const, ...next};
    let fired;
    [fired, rtconfig] = fairStep(simtime, rtconfig, event, statechart, statechart.root);
    // the just-performed fair step may add new internal events:
    remaining.push(...getRaisedEvents(fired, "raisedInternal"));
    result.push({event, fired});
  }

  return [result, rtconfig];
}

function resolveHistory(tgt: AbstractState, history: RT_History): Set<string> {
  if (tgt.kind === "shallow" || tgt.kind === "deep") {
    const toEnter = history.get(tgt.uid) || new Set();
    // tracer.log(`restore ${tgt.kind} history of ${stateDescription(tgt.parent!)} = ${logHistoryValue(toEnter)}`);
    return toEnter;
  }
  else {
    const toEnter = new Set([tgt.uid]);
    return toEnter;
  }
}

function fire(simtime: number, rt: RuntimeConfiguration, transition: Transition, label: TransitionLabel): [RuntimeConfiguration, FiredTransition] {
  const scope = {kind: "transition" as const, thing: transition};

  let exited, entered;

  [rt, exited] = exitChildren(rt, transition.arena);

  // transition actions
  const [newEnv, transitionActions] = label.actions.reduce(([env, transitionActions], action) => {
    const [newEnv, as] = execAction(env, action, scope, [transition.uid]);
    return [newEnv, [...transitionActions, ...as]];
  }, [rt.environment, [] as ExecutedAction[]] as const)

  rt = {...rt, environment: newEnv};

  const tgtPath = computePath({ancestor: transition.arena, descendant: transition.tgt});
  const toEnter = resolveHistory(transition.tgt, rt.history)
    .union(new Set(tgtPath.map(s=>s.uid)));

  [rt, entered] = enterChildren(simtime, rt, transition.arena, toEnter);

  const newEnv2 = deleteVariables(rt.environment, scope);

  rt = {...rt, environment: newEnv2};

  return [rt, {
    transitionUID: transition.uid,
    arenaUID: transition.arena.uid,
    exited: exited[0]!, // the arena is always an OR-state, so we can safely assume one child is exited
    transitionActions,
    entered: entered[0]!, // the arena is always an OR-state, so we can safely assume one child is entered
  }];
}

function deleteVariables(env: Environment, scope: Scope) {
  const variablesToDelete = [...env.entries(scope)];
  if (variablesToDelete.length > 0) {
    // tracer.log(`delete: ${[...rt.environment.entries(scope)].map(([key]) => key).join(', ')}`);
    return env.clearScope(scope);
  }
  return env;
}
