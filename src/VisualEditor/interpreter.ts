import { act } from "react";
import { evalExpr } from "./actionlang_interpreter";
import { computeArena, ConcreteState, getDescendants, isAncestorOf, isOverlapping, OrState, Statechart, stateDescription, Transition } from "./ast";
import { Action } from "./label_ast";
import { Environment, RaisedEvents, Mode, RT_Statechart, initialRaised } from "./runtime_types";

export function initialize(ast: Statechart): RT_Statechart {
  const {enteredStates, environment, ...raised} = enterDefault(ast.root, {
    environment: new Map(),
    ...initialRaised,
  });
  return {
    mode: enteredStates,
    environment,
    ...raised,
  };
}

type ActionScope = {
  environment: Environment,
} & RaisedEvents;

type EnteredScope = { enteredStates: Mode } & ActionScope;

export function enterDefault(state: ConcreteState, rt: ActionScope): EnteredScope {
  let actionScope = rt;

  // execute entry actions
  for (const action of state.entryActions) {
    (actionScope = execAction(action, actionScope));
  }

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(child, actionScope));
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
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(state.initial[0][1], actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    console.warn(state.uid + ': no initial state');
  }

  return {enteredStates, ...actionScope};
}

export function enterPath(path: ConcreteState[], rt: ActionScope): EnteredScope {
  let actionScope = rt;

  const [state, ...rest] = path;

  // execute entry actions
  for (const action of state.entryActions) {
    (actionScope = execAction(action, actionScope));
  }

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      if (rest.length > 0 && child.uid === rest[0].uid) {
        ({enteredStates: enteredChildren, ...actionScope} = enterPath(rest, actionScope));
      }
      else {
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(child, actionScope));
      }
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    if (rest.length > 0) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterPath(rest, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else {
      // same as AND-state, but we only enter the initial state(s)
      for (const [_, child] of state.initial) {
        let enteredChildren;
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(child, actionScope));
        enteredStates = enteredStates.union(enteredChildren);
      }
    }
  }

  return { enteredStates, ...actionScope };
}

// exit the given state and all its active descendants
export function exitCurrent(state: ConcreteState, rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  // exit all active children...
  for (const child of state.children) {
    if (enteredStates.has(child.uid)) {
      actionScope = exitCurrent(child,  {enteredStates, ...actionScope});
    }
  }

  // execute exit actions
  for (const action of state.exitActions) {
    (actionScope = execAction(action, actionScope));
  }

  return actionScope;
}

export function exitPath(path: ConcreteState[], rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  const toExit = enteredStates.difference(new Set(path));

  const [state, ...rest] = path;
  
  // exit state and all its children, *except* states along the rest of the path
  actionScope = exitCurrent(state,  {enteredStates: toExit, ...actionScope});
  if (rest.length > 0) {
    actionScope = exitPath(rest, {enteredStates, ...actionScope});
  }

  // execute exit actions
  for (const action of state.exitActions) {
    (actionScope = execAction(action, actionScope));
  }

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

export function handleEvent(event: string, statechart: Statechart, activeParent: ConcreteState, {environment, mode, ...raised}: RT_Statechart): RT_Statechart {
  const arenasFired = new Set<OrState>();
  for (const state of activeParent.children) {
    if (mode.has(state.uid)) {
      const outgoing = statechart.transitions.get(state.uid) || [];
      const triggered = outgoing.filter(transition => transition.label[0].trigger.kind === "event" && transition.label[0].trigger.event === event);
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
          ({mode, environment, ...raised} = fireTransition(t, arena, srcPath, tgtPath, {mode, environment, ...raised}));
          arenasFired.add(arena);
        }
        else {
          console.log('skip (overlapping arenas)');
        }
      }
      else {
        // no enabled outgoing transitions, try the children:
        ({environment, mode, ...raised} = handleEvent(event, statechart, state, {environment, mode, ...raised}));
      }
    }
  }
  return {environment, mode, ...raised};
}

function transitionDescription(t: Transition) {
  return stateDescription(t.src) + ' ➔ ' + stateDescription(t.tgt);
}

export function fireTransition(t: Transition, arena: OrState, srcPath: ConcreteState[], tgtPath: ConcreteState[], {mode, environment, ...raised}: RT_Statechart): {mode: Mode, environment: Environment} & RaisedEvents {

  console.log('fire ', transitionDescription(t), {arena, srcPath, tgtPath});

  // exit src
  ({environment, ...raised} = exitPath(srcPath.slice(1), {environment, enteredStates: mode, ...raised}));
  const toExit = getDescendants(arena);
  toExit.delete(arena.uid); // do not exit the arena itself
  const exitedMode = mode.difference(toExit);

  console.log('exitedMode', exitedMode);

  // exec transition actions
  for (const action of t.label[0].actions) {
    ({environment, ...raised} = execAction(action, {environment, ...raised}));
  }

  // enter tgt
  let enteredStates;
  ({enteredStates, environment, ...raised} = enterPath(tgtPath.slice(1), {environment, ...raised}));
  const enteredMode = exitedMode.union(enteredStates);

  console.log('enteredMode', enteredMode);

  return {mode: enteredMode, environment, ...raised};
}
