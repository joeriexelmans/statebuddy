import { computeArena, ConcreteState, isAncestorOf, Statechart, Transition } from "./ast";
import { Action, Expression } from "./label_ast";
import { Environment, RaisedEvents, Mode, RT_Statechart, initialRaised } from "./runtime_types";

export function initialize(ast: Statechart): RT_Statechart {
  const {mode, environment, ...raised} = enterDefault(ast.root, {
    environment: new Map(),
    ...initialRaised,
  });
  return {
    mode,
    environment,
    inputEvents: [],
    ...raised,
  };
}

type ActionScope = {
  environment: Environment,
} & RaisedEvents;

type EnteredScope = { mode: Mode } & ActionScope;

export function enterDefault(state: ConcreteState, rt: ActionScope): EnteredScope {
  let actionScope = rt;

  // execute entry actions
  for (const action of state.entryActions) {
    (actionScope = execAction(action, actionScope));
  }

  // enter children...
  const mode: {[uid:string]: Mode} = {};
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let childMode;
      ({mode: childMode, ...actionScope} = enterDefault(child, actionScope));
      mode[child.uid] = childMode;
    }
  }
  else if (state.kind === "or") {
    // same as AND-state, but we only enter the initial state(s)
    for (const [_, child] of state.initial) {
      let childMode;
      ({mode: childMode, ...actionScope} = enterDefault(child, actionScope));
      mode[child.uid] = childMode;
    }
  }

  return { mode, ...actionScope };
}

export function enterPath(path: ConcreteState[], rt: ActionScope): EnteredScope {
  let actionScope = rt;

  const [state, ...rest] = path;

  // execute entry actions
  for (const action of state.entryActions) {
    (actionScope = execAction(action, actionScope));
  }

  // enter children...

  const mode: {[uid:string]: Mode} = {};
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let childMode;
      if (rest.length > 0 && child.uid === rest[0].uid) {
        ({mode: childMode, ...actionScope} = enterPath(rest, actionScope));
      }
      else {
        ({mode: childMode, ...actionScope} = enterDefault(child, actionScope));
      }
      mode[child.uid] = childMode;
    }
  }
  else if (state.kind === "or") {
    if (rest.length > 0) {
      let childMode;
      ({mode: childMode, ...actionScope} = enterPath(rest, actionScope));
      mode[rest[0].uid] = childMode;
    }
    else {
      // same as AND-state, but we only enter the initial state(s)
      for (const [_, child] of state.initial) {
        let childMode;
        ({mode: childMode, ...actionScope} = enterDefault(child, actionScope));
        mode[child.uid] = childMode;
      }
    }
  }

  return { mode, ...actionScope };
}

export function exitCurrent(state: ConcreteState, rt: EnteredScope): ActionScope {
  let {mode, ...actionScope} = rt;

  // exit all active children...
  for (const [childUid, childMode] of Object.entries(mode)) {
    const child = state.children.find(child => child.uid === childUid);
    if (child) {
      (actionScope = exitCurrent(child, {mode: childMode, ...actionScope}));
    }
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


const UNARY_OPERATOR_MAP: Map<string, (x:any)=>any> = new Map([
  ["!", x => !x],
  ["-", x => -x as any],
]);

const BINARY_OPERATOR_MAP: Map<string, (a:any,b:any)=>any> = new Map([
  ["+", (a,b) => a+b],
  ["-", (a,b) => a-b],
  ["*", (a,b) => a*b],
  ["/", (a,b) => a/b],
  ["&&", (a,b) => a&&b],
  ["||", (a,b) => a||b],
  ["==", (a,b) => a==b],
  ["<=", (a,b) => a<=b],
  [">=", (a,b) => a>=b],
  ["<", (a,b) => a<b],
  [">", (a,b) => a>b],
]);

export function evalExpr(expr: Expression, environment: Environment): any {
  if (expr.kind === "literal") {
    return expr.value;
  }
  else if (expr.kind === "ref") {
    const found = environment.get(expr.variable);
    if (found === undefined) {
      throw new Error(`variable '${expr.variable}' does not exist in environment`)
    }
    return found;
  }
  else if (expr.kind === "unaryExpr") {
    const arg = evalExpr(expr.expr, environment);
    return UNARY_OPERATOR_MAP.get(expr.operator)!(arg);
  }
  else if (expr.kind === "binaryExpr") {
    const lhs = evalExpr(expr.lhs, environment);
    const rhs = evalExpr(expr.rhs, environment);
    return BINARY_OPERATOR_MAP.get(expr.operator)!(lhs,rhs);
  }
  throw new Error("should never reach here");
}

export function getActiveStates(mode: Mode): Set<string> {
  return new Set([].concat(
    ...Object.entries(mode).map(([childUid, childMode]) =>
      [childUid, ...getActiveStates(childMode)])
  ));
}

export function raiseEvent(event: string, statechart: Statechart, sourceState: ConcreteState, rt: RT_Statechart): RT_Statechart[] {
  const activeStates = sourceState.children.filter(child => rt.mode.hasOwnProperty(child.uid))
  for (const state of activeStates) {
    const outgoing = statechart.transitions.get(state.uid) || [];
    const enabled = outgoing.filter(transition => transition.label[0].trigger.kind === "event" && transition.label[0].trigger.event === event);
    const enabledGuard = enabled.filter(transition =>
      evalExpr(transition.label[0].guard, rt.environment)
    );
    if (enabledGuard.length > 0) {
      const newRts = enabledGuard.map(t => fireTransition(t, statechart, rt));
      return newRts;
    }
    else {
      // no enabled outgoing transitions, try the children:
      return raiseEvent(event, statechart, state, rt);
    }
  }
  return [];
}

function setModeDeep(oldMode: Mode, pathToState: ConcreteState[], newMode: Mode): Mode {
  if (pathToState.length === 0) {
    return newMode;
  }
  const [next, ...rest] = pathToState;
  return {
    ...oldMode,
    [next.uid]: setModeDeep(oldMode[next.uid], rest, newMode),
  }
}

function unsetModeDeep(oldMode: Mode, pathToState: ConcreteState[]): Mode {
  if (pathToState.length === 0) {
    return {};
  }
  if (pathToState.length === 1) {
    const keyToDelete = pathToState[0].uid;
    const newMode = {...oldMode}; // shallow copy
    delete newMode[keyToDelete];
    return newMode;
  }
  const [next, ...rest] = pathToState;
  return {
    ...oldMode,
    [next.uid]: unsetModeDeep(oldMode[next.uid], rest),
  }
}

export function fireTransition(t: Transition, statechart: Statechart, rt: RT_Statechart): RT_Statechart {
  const {arena, srcPath, tgtPath} = computeArena(t);
  const pathToArena = isAncestorOf({ancestor: statechart.root, descendant: arena}) as ConcreteState[];
  console.log('fire ', t.src.comments[0][1], '->', t.tgt.comments[0][1], {srcPath, tgtPath});
  let {environment, ...raised} = exitCurrent(srcPath[1], rt);
  const exitedMode = unsetModeDeep(rt.mode, [...pathToArena.slice(1), ...srcPath.slice(1)]);
  for (const action of t.label[0].actions) {
    ({environment, ...raised} = execAction(action, {environment, ...raised}));
  }
  let deepMode;
  ({mode: deepMode, environment, ...raised} = enterPath(tgtPath.slice(1), {environment, ...raised}));
  // console.log('entered path:', tgtPath.slice(1), {deepMode});
  const enteredMode = setModeDeep(exitedMode, [...pathToArena.slice(1), ...tgtPath.slice(1)], deepMode);
  // console.log('pathToArena:', pathToArena, 'newMode:', enteredMode);
  return {mode: enteredMode, environment, inputEvents: rt.inputEvents, ...raised};
}
