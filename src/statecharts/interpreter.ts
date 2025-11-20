import { AbstractState, computeArena, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition, transitionDescription, TransitionSrcTgt } from "./abstract_syntax";
import { evalExpr } from "./actionlang_interpreter";
import { Environment, FlatEnvironment } from "./environment";
import { Action, EventTrigger, TransitionLabel } from "./label_ast";
import { BigStep, initialRaised, Mode, RaisedEvents, RT_Event, RT_History, RT_Statechart, TimerElapseEvent, Timers } from "./runtime_types";

const initialEnv = new Map<string, any>([
  ["_timers", []],
  ["_log", (str: string) => console.log(str)],
]);
// const initialScopedEnvironment = new ScopedEnvironment({env: initialEnv, children: {}});
const intiialFlatEnvironment = new FlatEnvironment(initialEnv);

export function initialize(ast: Statechart): BigStep {
  let history = new Map();
  let enteredStates, environment, rest;
  ({enteredStates, environment, history, ...rest} = enterDefault(0, ast.root, {
    environment: intiialFlatEnvironment,
    history,
    ...initialRaised,
  }));
  return handleInternalEvents(0, ast, {mode: enteredStates, environment, history,  ...rest});
}

type ActionScope = {
  environment: Environment,
  history: RT_History,
} & RaisedEvents;

type EnteredScope = { enteredStates: Mode } & ActionScope;

export class RuntimeError extends Error {
  highlight: string[];
  constructor(message: string, highlight: string[]) {
    super(message);
    this.highlight = highlight;
  }
}

export class NonDeterminismError extends RuntimeError {}

export function execAction(action: Action, rt: ActionScope, uids: string[]): ActionScope {
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

export function entryActions(simtime: number, state: TransitionSrcTgt, actionScope: ActionScope): ActionScope {
  console.log('enter', state, '...');

  let {environment, ...rest} = actionScope;

  for (const action of state.entryActions) {
    ({environment, ...rest} = execAction(action, {environment, ...rest}, [state.uid]));
  }

  // schedule timers
  if (state.kind !== "pseudo") {
    // we store timers in the environment (dirty!)
    const timers: Timers = environment.get("_timers") || [];
    const newTimers = [
      ...timers,
      ...state.timers.map(timeOffset => {
        const futureSimTime = simtime + timeOffset;
        return [futureSimTime, {kind: "timer", state: state.uid, timeDurMs: timeOffset}] as [number, TimerElapseEvent];
      }),
    ];
    newTimers.sort((a,b) => a[0] - b[0]); // earliest timers come first
    environment = environment.set("_timers", newTimers);
    // console.log('schedule timers of ', stateDescription(state));
    // console.log('newTimers:', newTimers);
  }
  return {environment, ...rest};
}

export function exitActions(simtime: number, state: TransitionSrcTgt, {enteredStates, ...actionScope}: EnteredScope): ActionScope {
  // console.log('exit', stateDescription(state), '...');

  let environment = actionScope.environment;

  for (const action of state.exitActions) {
    (actionScope = execAction(action, actionScope, [state.uid]));
  }

  // cancel timers
  if (state.kind !== "pseudo") {
    const timers: Timers = environment.get("_timers") || [];
    const newTimers = timers.filter(([_, {state: s}]) => s !== state.uid);
    environment = environment.set("_timers", newTimers);
    // console.log('cancel timers of ', stateDescription(state));
    // console.log('newTimers:', newTimers);
  }

  return {...actionScope, environment};
}

// recursively enter the given state's default state
export function enterDefault(simtime: number, state: ConcreteState, rt: ActionScope): EnteredScope {
  let {firedTransitions, environment, ...actionScope} = rt;

  environment = environment.enterScope(state.uid);

  let enteredStates = new Set([state.uid]);

  // execute entry actions
  ({firedTransitions, environment, ...actionScope} = entryActions(simtime, state, {firedTransitions, environment, ...actionScope}));

  // enter children...
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, firedTransitions, environment, ...actionScope} = enterDefault(simtime, child, {firedTransitions, environment, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // same as AND-state, but we only enter the initial state(s)
    if (state.initial.length > 0) {
      if (state.initial.length > 1) {
        throw new NonDeterminismError(`Non-determinism: state '${stateDescription(state)} has multiple (${state.initial.length}) initial states.`, [...state.initial.map(i => i[0]), state.uid]);
      }
      const [arrowUid, toEnter] = state.initial[0];
      firedTransitions = [...firedTransitions, arrowUid];
      let enteredChildren;
      ({enteredStates: enteredChildren, firedTransitions, environment, ...actionScope} = enterDefault(simtime, toEnter, {firedTransitions, environment, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else {
      throw new RuntimeError(state.uid + ': no initial state', [state.uid]);
    }
  }  

  environment = environment.exitScope();

  return {enteredStates, firedTransitions, environment, ...actionScope};
}

// recursively enter the given state and, if children need to be entered, preferrably those occurring in 'toEnter' will be entered. If no child occurs in 'toEnter', the default child will be entered.
export function enterStates(simtime: number, state: ConcreteState, toEnter: Set<string>, {environment, ...actionScope}: ActionScope): EnteredScope {

  console.log('enterStates', state);

  environment = environment.enterScope(state.uid);

  // execute entry actions
  console.log('entry actions...');
  actionScope = entryActions(simtime, state, {environment, ...actionScope});

  // enter children...
  let enteredStates = new Set([state.uid]);

  if (state.kind === "and") {
    // every child must be entered
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, environment, ...actionScope} = enterStates(simtime, child, toEnter, {environment, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // only one child can be entered
    const childToEnter = state.children.filter(child => toEnter.has(child.uid));
    if (childToEnter.length === 1) {
      // good
      let enteredChildren;
      ({enteredStates: enteredChildren, environment, ...actionScope} = enterStates(simtime, childToEnter[0], toEnter, {environment, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else if (childToEnter.length === 0) {
      // also good, enter default child
      console.log('enter default...', state.initial[0][1]);
      return enterDefault(simtime, state.initial[0][1], {environment, ...actionScope});
    }
    else {
      throw new Error("can only enter one child of an OR-state, stupid!");
    }
  }

  environment = environment.exitScope();

  return { enteredStates, environment, ...actionScope };
}

// exit the given state and all its active descendants
export function exitCurrent(simtime: number, state: ConcreteState, rt: EnteredScope): ActionScope {
  // console.log('exitCurrent', stateDescription(state));
  let {enteredStates, history, environment, ...actionScope} = rt;

  environment = environment.enterScope(state.uid);

  if (enteredStates.has(state.uid)) {
    // exit all active children...
    if (state.children) {
      for (const child of state.children) {
        ({history, environment, ...actionScope} = exitCurrent(simtime, child,  {enteredStates, history, environment, ...actionScope}));
      }
    }

    // execute exit actions
    ({history, environment, ...actionScope} = exitActions(simtime, state, {enteredStates, history, environment, ...actionScope}));

    // record history
    if (state.history) {
      history = new Map(history); // defensive copy
      for (const h of state.history) {
        if (h.kind === "shallow") {
          history.set(h.uid, new Set(state.children
            .filter(child => enteredStates.has(child.uid))
            .map(child => child.uid)));
        }
        else if (h.kind === "deep") {
          // horribly inefficient (i don't care)
          history.set(h.uid,
            getDescendants(state)
            .difference(new Set([state.uid]))
            .intersection(enteredStates)
          );
        }
      }
    }
  }

  environment = environment.exitScope();

  return {history, environment, ...actionScope};
}

function allowedToFire(arena: OrState, alreadyFiredArenas: OrState[]) {
  for (const alreadyFired of alreadyFiredArenas) {
    if (isOverlapping(arena, alreadyFired))
      return false;
  }
  return true;
}

function attemptSrcState(simtime: number, sourceState: AbstractState, event: RT_Event|undefined, statechart: Statechart, {environment, mode, arenasFired, ...rest}: RT_Statechart & RaisedEvents): (RT_Statechart & RaisedEvents) | undefined {
  const addEventParam = (event && event.kind === "input" && event.param !== undefined) ?
    (environment: Environment, label: TransitionLabel) => {
      const varName = (label.trigger as EventTrigger).paramName as string;
      if (varName) {
        const result = environment.newVar(varName, event.param);
        return result;
      }
      return environment;
    }
    : (environment: Environment) => environment;
  // console.log('attemptSrcState', stateDescription(sourceState), arenasFired);
  const outgoing = statechart.transitions.get(sourceState.uid) || [];
  const labels = outgoing.flatMap(t =>
    t.label
      .filter(l => l.kind === "transitionLabel")
      .map(l => [t,l] as [Transition, TransitionLabel]));
  let triggered: [Transition, TransitionLabel][];
  if (event !== undefined) {
    if (event.kind === "input") {
      // get transitions triggered by event
      triggered = labels.filter(([_t,l]) =>
        l.trigger.kind === "event" && l.trigger.event === event.name);
    }
    else /*if (event.kind === "timer")*/ {
      // get transitions triggered by timeout
      triggered = labels.filter(([_t,l]) =>
        l.trigger.kind === "after" && sourceState.uid === event.state && l.trigger.durationMs === event.timeDurMs);
    }
  }
  else {
      triggered = labels.filter(([_t,l]) => l.trigger.kind === "triggerless");
  }

  // eval guard
  const inState = (stateLabel: string) => {
    for (const [uid, state] of statechart.uid2State.entries()) {
      if (stateDescription(state) === stateLabel) {
        return (mode.has(uid));
      }
    }
  };
  const guardEnvironment = environment.set("inState", inState);
  const enabled = triggered.filter(([t,l]) => evalExpr(l.guard, addEventParam(guardEnvironment, l), [t.uid]));
  if (enabled.length > 0) {
    if (enabled.length > 1) {
      throw new NonDeterminismError(`Non-determinism: state '${stateDescription(sourceState)}' has multiple (${enabled.length}) enabled outgoing transitions: ${enabled.map(([t]) => transitionDescription(t)).join(', ')}`, [...enabled.map(([t]) => t.uid), sourceState.uid]);
    }
    const [toFire, label] = enabled[0];
    const arena = computeArena(toFire.src, toFire.tgt);
    if (allowedToFire(arena, arenasFired)) {
      ({mode, environment, ...rest} = fire(simtime, toFire, statechart.transitions, label, arena, {mode, environment, ...rest}, addEventParam));
      rest = {...rest, firedTransitions: [...rest.firedTransitions, toFire.uid]}
      arenasFired = [...arenasFired, arena];

      // if there is any pseudo-state in the modal configuration, immediately fire any enabled outgoing transitions of that state:
      for (const activeState of mode) {
        const s = statechart.uid2State.get(activeState);
        if (s?.kind === "pseudo") {
          // console.log('fire pseudo-state...');
          const newConfig = attemptSrcState(simtime, s, undefined, statechart, {environment, mode, arenasFired: [], ...rest});
          if (newConfig === undefined) {
            throw new RuntimeError("Stuck in choice-state.", [activeState]);
          }
          arenasFired = [...arenasFired, ...newConfig.arenasFired];
          return {...newConfig, arenasFired};
        }
      }
      return {mode, environment, arenasFired, ...rest};
    }
  }
}

// A fair step is a response to one (input|internal) event, where possibly multiple transitions are made as long as their arenas do not overlap. A reasonably accurate and more intuitive explanation is that every orthogonal region is allowed to fire at most one transition.
export function fairStep(simtime: number, event: RT_Event, statechart: Statechart, activeParent: StableState, {arenasFired, environment, ...config}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  environment = environment.enterScope(activeParent.uid);
  // console.log('fairStep', arenasFired);
  for (const state of activeParent.children) {
    if (config.mode.has(state.uid)) {
      const didFire = attemptSrcState(simtime, state, event, statechart, {...config, environment, arenasFired});
      if (didFire) {
        ({arenasFired, environment, ...config} = didFire);
      }
      else {
        // no enabled outgoing transitions, try the children:
        // console.log('attempt children');
        ({arenasFired, environment, ...config} = fairStep(simtime, event, statechart, state, {...config, environment, arenasFired}));
      }
    }
  }
  environment = environment.exitScope();
  return {arenasFired, environment, ...config};
}

export function handleInputEvent(simtime: number, event: RT_Event, statechart: Statechart, {mode, environment, history}: {mode: Mode, environment: Environment, history: RT_History}): BigStep {
  let raised = initialRaised;

  ({mode, environment, ...raised} = fairStep(simtime, event, statechart, statechart.root, {mode, environment, history, arenasFired: [], ...raised}));

  return {inputEvent: event, ...handleInternalEvents(simtime, statechart, {mode, environment, history, ...raised})};
}

export function handleInternalEvents(simtime: number, statechart: Statechart, {internalEvents, ...rest}: RT_Statechart & RaisedEvents) {
  while (internalEvents.length > 0) {
    const [nextEvent, ...remainingEvents] = internalEvents;
    ({internalEvents, ...rest} = fairStep(simtime, 
      {kind: "input", ...nextEvent}, // internal event becomes input event
      statechart, statechart.root, { ...rest, arenasFired: [], internalEvents: remainingEvents, }));
  }
  return rest;
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

export function fire(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, history, ...rest}: RT_Statechart & RaisedEvents, addEventParam: (env: Environment, label: TransitionLabel) => Environment): RT_Statechart & RaisedEvents {

  console.log('will now fire', transitionDescription(t), 'arena', arena);

  const srcPath = computePath({ancestor: arena, descendant: t.src as ConcreteState}) as ConcreteState[];

  // console.log(srcPath);
  // console.log('arena:', arena, 'srcPath:', srcPath);

  // exit src and other states up to arena
  ({environment, history, ...rest} = exitCurrent(simtime, srcPath[0], {environment, enteredStates: mode, history, ...rest}));
  const toExit = getDescendants(arena);
  toExit.delete(arena.uid); // do not exit the arena itself
  const exitedMode = mode.difference(toExit); // active states after exiting

  // console.log('toExit', toExit);
  // console.log('exitedMode', exitedMode);

  // transition actions
  environment = addEventParam(environment.enterScope("<transition>"), label);
  for (const action of label.actions) {
    ({environment, history, ...rest} = execAction(action, {environment, history, ...rest}, [t.uid]));
  }
  environment = environment.dropScope();

  const tgtPath = computePath({ancestor: arena, descendant: t.tgt});
  const state = tgtPath[0] as ConcreteState; // first state to enter
  const toEnter = resolveHistory(t.tgt, history)
    .union(new Set(tgtPath.map(s=>s.uid)));

  console.log({arena, state, toEnter});

  let enteredStates;
  ({enteredStates, environment, history, ...rest} = enterStates(simtime, state, toEnter, {environment, history, ...rest}));
  const enteredMode = exitedMode.union(enteredStates);

  // console.log('new mode', enteredMode);

  // console.log('done firing', transitionDescription(t));

  return {mode: enteredMode, environment, history, ...rest};
}

// export function fireTransition(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, history, ...rest}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
//   console.log('fire', transitionDescription(t));

//   const srcPath = computePath({ancestor: arena, descendant: t.src as ConcreteState}).reverse() as ConcreteState[];

//   // console.log('arena:', arena, 'srcPath:', srcPath);

//   // exit src and other states up to arena
//   ({environment, history, ...rest} = exitCurrent(simtime, srcPath[0], {environment, enteredStates: mode, history, ...rest}))
//   const toExit = getDescendants(arena);
//   toExit.delete(arena.uid); // do not exit the arena itself
//   const exitedMode = mode.difference(toExit); // active states after exiting the states we need to exit

//   // console.log({exitedMode});

//   return fireSecondHalfOfTransition(simtime, t, ts, label, arena, {mode: exitedMode, history, environment, ...rest});
// }

// // assuming we've already exited the source state of the transition, now enter the target state
// // IF however, the target is a pseudo-state, DON'T enter it (pseudo-states are NOT states), instead fire the first pseudo-outgoing transition.
// export function fireSecondHalfOfTransition(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, history, firedTransitions, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
//   console.log('fire (2nd half)', transitionDescription(t));
//   // exec transition actions
//   for (const action of label.actions) {
//     ({environment, history, firedTransitions, ...raised} = execAction(action, {environment, history, firedTransitions, ...raised}));
//   }

//   firedTransitions = [...firedTransitions, t.uid];

//   if (t.tgt.kind === "pseudo") {
//     const outgoing = ts.get(t.tgt.uid) || [];
//     for (const nextT of outgoing) {
//       for (const nextLabel of nextT.label) {
//         if (nextLabel.kind === "transitionLabel") {
//           if (evalExpr(nextLabel.guard, environment)) {
//             console.log('fire', transitionDescription(nextT));
//             // found ourselves an enabled transition
//             return fireSecondHalfOfTransition(simtime, nextT, ts, nextLabel, arena, {mode, environment, history, firedTransitions, ...raised});
//           }
//         }
//       }
//     }
//     throw new Error("stuck in pseudo-state!!");
//   }
//   else {
//     const tgtPath = computePath({ancestor: arena, descendant: t.tgt});
//     const state = tgtPath[0] as ConcreteState;
//     let toEnter;
//     if (t.tgt.kind === "deep" || t.tgt.kind === "shallow") {
//       toEnter = new Set([
//         ...tgtPath.slice(0,-1).map(s => s.uid),
//         ...history.get(t.tgt.uid)!
//       ]) as Set<string>;
//     }
//     else {
//       toEnter = new Set(tgtPath.map(s=>s.uid));
//     }
    
//     // enter tgt
//     let enteredStates;
//     ({enteredStates, environment, history, firedTransitions, ...raised} = enterStates(simtime, state, toEnter, {environment, history, firedTransitions, ...raised}));
//     const enteredMode = mode.union(enteredStates);

//     // console.log({enteredMode});

//     return {mode: enteredMode, environment, history, firedTransitions, ...raised};
//   }
// }
