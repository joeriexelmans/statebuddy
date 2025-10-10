import { evalExpr } from "./actionlang_interpreter";
import { computeArena, ConcreteState, getDescendants, isOverlapping, OrState, Statechart, stateDescription, Transition } from "./ast";
import { Action } from "./label_ast";
import { Environment, RaisedEvents, Mode, RT_Statechart, initialRaised, BigStepOutput } from "./runtime_types";

export function initialize(ast: Statechart): BigStepOutput {
  let {enteredStates, environment, ...raised} = enterDefault(0, ast.root, {
    environment: new Map(),
    ...initialRaised,
  });
  return handleInternalEvents(0, ast, {mode: enteredStates, environment, ...raised});
}

type ActionScope = {
  environment: Environment,
} & RaisedEvents;

type EnteredScope = { enteredStates: Mode } & ActionScope;

type TimerElapseEvent = {state: string, timeDurMs: number};
type Timers = [number, TimerElapseEvent][];

export function entryActions(simtime: number, state: ConcreteState, actionScope: ActionScope): ActionScope {
  for (const action of state.entryActions) {
    (actionScope = execAction(action, actionScope));
  }
  // schedule timers
  // we store timers in the environment (dirty!)
  const environment = new Map(actionScope.environment);
  const timers: Timers = [...(environment.get("_timers") || [])];
  for (const timeOffset of state.timers) {
    const futureSimTime = simtime + timeOffset; // point in simtime when after-trigger becomes enabled
    timers.push([futureSimTime, {state: state.uid, timeDurMs: timeOffset}]);
  }
  timers.sort((a,b) => a[0] - b[0]); // smallest futureSimTime comes first
  environment.set("_timers", timers);
  return {...actionScope, environment};
}

export function exitActions(simtime: number, state: ConcreteState, actionScope: ActionScope): ActionScope {
  for (const action of state.exitActions) {
    (actionScope = execAction(action, actionScope));
  }
  // cancel timers
  const environment = new Map(actionScope.environment);
  const timers: Timers = environment.get("_timers") || [];
  const filtered = timers.filter(([_, {state: s}]) => s !== state.uid);
  environment.set("_timers", filtered);
  return {...actionScope, environment};
}

export function enterDefault(simtime: number, state: ConcreteState, rt: ActionScope): EnteredScope {
  let actionScope = rt;

  // execute entry actions
  actionScope = entryActions(simtime, state, actionScope);

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // same as AND-state, but we only enter the initial state(s)
    if (state.initial.length > 0) {
      if (state.initial.length > 1) {
        console.warn(state.uid + ': multiple initial states, only entering one of them');
      }
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, state.initial[0][1], actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    console.warn(state.uid + ': no initial state');
  }

  return {enteredStates, ...actionScope};
}

export function enterPath(simtime: number, path: ConcreteState[], rt: ActionScope): EnteredScope {
  let actionScope = rt;

  const [state, ...rest] = path;

  // execute entry actions
  actionScope = entryActions(simtime, state, actionScope);

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      if (rest.length > 0 && child.uid === rest[0].uid) {
        ({enteredStates: enteredChildren, ...actionScope} = enterPath(simtime, rest, actionScope));
      }
      else {
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
      }
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    if (rest.length > 0) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterPath(simtime, rest, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else {
      // same as AND-state, but we only enter the initial state(s)
      for (const [_, child] of state.initial) {
        let enteredChildren;
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
        enteredStates = enteredStates.union(enteredChildren);
      }
    }
  }

  return { enteredStates, ...actionScope };
}

// exit the given state and all its active descendants
export function exitCurrent(simtime: number, state: ConcreteState, rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  // exit all active children...
  for (const child of state.children) {
    if (enteredStates.has(child.uid)) {
      actionScope = exitCurrent(simtime, child,  {enteredStates, ...actionScope});
    }
  }

  // execute exit actions
  actionScope = exitActions(simtime, state, actionScope);

  return actionScope;
}

export function exitPath(simtime: number, path: ConcreteState[], rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  const toExit = enteredStates.difference(new Set(path));

  const [state, ...rest] = path;
  
  // exit state and all its children, *except* states along the rest of the path
  actionScope = exitCurrent(simtime, state,  {enteredStates: toExit, ...actionScope});
  if (rest.length > 0) {
    actionScope = exitPath(simtime, rest, {enteredStates, ...actionScope});
  }

  // execute exit actions
  actionScope = exitActions(simtime, state, actionScope);

  return actionScope;
}

export function execAction(action: Action, rt: ActionScope): ActionScope {
  if (action.kind === "assignment") {
    const rhs = evalExpr(action.rhs, rt.environment);
    const newEnvironment = new Map(rt.environment);
    newEnvironment.set(action.lhs, rhs);
    return {
      ...rt,
      environment: newEnvironment,
    };
  }
  else if (action.kind === "raise") {
    if (action.event.startsWith('_')) {
      // append to internal events
      return {
        ...rt,
        internalEvents: [...rt.internalEvents, action.event],
      };
    }
    else {
      // append to output events
      return {
        ...rt,
        outputEvents: [...rt.outputEvents, action.event],
      }
    }
  }
  throw new Error("should never reach here");
}

export function handleEvent(simtime: number, event: string | TimerElapseEvent, statechart: Statechart, activeParent: ConcreteState, {environment, mode, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  const arenasFired = new Set<OrState>();
  for (const state of activeParent.children) {
    if (mode.has(state.uid)) {
      const outgoing = statechart.transitions.get(state.uid) || [];
      let triggered;
      if (typeof event === 'string') {
        triggered = outgoing.filter(transition => {
          const trigger = transition.label[0].trigger;
          if (trigger.kind === "event") {
            return trigger.event === event;
          }
          return false;
        });
      }
      else {
        triggered = outgoing.filter(transition => {
          const trigger = transition.label[0].trigger;
          if (trigger.kind === "after") {
            return trigger.durationMs === event.timeDurMs;
          }
          return false;
        });
      }
      const enabled = triggered.filter(transition =>
        evalExpr(transition.label[0].guard, environment)
      );
      if (enabled.length > 0) {
        if (enabled.length > 1) {
          console.warn('nondeterminism!!!!');
        }
        const t = enabled[0];
        console.log('enabled:', transitionDescription(t));
        const {arena, srcPath, tgtPath} = computeArena(t);
        let overlapping = false;
        for (const alreadyFired of arenasFired) {
          if (isOverlapping(arena, alreadyFired)) {
            overlapping = true;
          }
        }
        if (!overlapping) {
          console.log('^ firing');
          ({mode, environment, ...raised} = fireTransition(simtime, t, arena, srcPath, tgtPath, {mode, environment, ...raised}));
          arenasFired.add(arena);
        }
        else {
          console.log('skip (overlapping arenas)');
        }
      }
      else {
        // no enabled outgoing transitions, try the children:
        ({environment, mode, ...raised} = handleEvent(simtime, event, statechart, state, {environment, mode, ...raised}));
      }
    }
  }
  return {environment, mode, ...raised};
}

export function handleInputEvent(simtime: number, event: string, statechart: Statechart, {mode, environment}: {mode: Mode, environment: Environment}): BigStepOutput {
  let raised = initialRaised;

  ({mode, environment, ...raised} = handleEvent(simtime, event, statechart, statechart.root, {mode, environment, ...raised}));

  return handleInternalEvents(simtime, statechart, {mode, environment, ...raised});
}

export function handleInternalEvents(simtime: number, statechart: Statechart, {mode, environment, ...raised}: RT_Statechart & RaisedEvents): BigStepOutput {
  while (raised.internalEvents.length > 0) {
    const [internalEvent, ...rest] = raised.internalEvents;
    ({mode, environment, ...raised} = handleEvent(simtime, internalEvent, statechart, statechart.root, {mode, environment, internalEvents: rest, outputEvents: raised.outputEvents}));
  }
  return {mode, environment, outputEvents: raised.outputEvents};
}

function transitionDescription(t: Transition) {
  return stateDescription(t.src) + ' ➔ ' + stateDescription(t.tgt);
}

export function fireTransition(simtime: number, t: Transition, arena: OrState, srcPath: ConcreteState[], tgtPath: ConcreteState[], {mode, environment, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {

  // console.log('fire ', transitionDescription(t), {arena, srcPath, tgtPath});

  // exit src
  ({environment, ...raised} = exitPath(simtime, srcPath.slice(1), {environment, enteredStates: mode, ...raised}));
  const toExit = getDescendants(arena);
  toExit.delete(arena.uid); // do not exit the arena itself
  const exitedMode = mode.difference(toExit);

  // exec transition actions
  for (const action of t.label[0].actions) {
    ({environment, ...raised} = execAction(action, {environment, ...raised}));
  }

  // enter tgt
  let enteredStates;
  ({enteredStates, environment, ...raised} = enterPath(simtime, tgtPath.slice(1), {environment, ...raised}));
  const enteredMode = exitedMode.union(enteredStates);

  return {mode: enteredMode, environment, ...raised};
}
