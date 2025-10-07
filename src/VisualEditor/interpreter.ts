import { ConcreteState, Statechart } from "./ast";
import { Action, Expression } from "./label_ast";
import { Environment, RaisedEvents, Mode, RT_Statechart, initialRaised } from "./runtime_types";

export function initialize(ast: Statechart): RT_Statechart {
  const {mode, environment, raised} = enter(ast.root, {
    environment: new Map(),
    raised: initialRaised,
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
  raised: RaisedEvents,
};

type EnteredScope = { mode: Mode } & ActionScope;

export function enter(state: ConcreteState, rt: ActionScope): EnteredScope {
  let {environment, raised} = rt;

  // execute entry actions
  for (const action of state.entryActions) {
    ({environment, raised} = execAction(action, {environment, raised}));
  }

  // enter children...
  const mode: {[uid:string]: Mode} = {};
  if (state.kind === "and") {
    
    for (const child of state.children) {
      let childMode;
      ({mode: childMode, environment, raised} = enter(child, {environment, raised}));
      mode[child.uid] = childMode;
    }
  }
  else if (state.kind === "or") {
    const mode: {[uid:string]: Mode} = {};
    // same as AND-state, but we only enter the initial state(s)
    for (const [_, child] of state.initial) {
      let childMode;
      ({mode: childMode, environment, raised} = enter(child, {environment, raised}));
      mode[child.uid] = childMode;
    }
  }

  return { mode, environment, raised };
}

export function exit(state: ConcreteState, rt: EnteredScope): ActionScope {
  let {mode, environment, raised} = rt;

  // exit all active children...
  for (const [childUid, childMode] of Object.entries(mode)) {
    const child = state.children.find(child => child.uid === childUid);
    if (child) {
      ({environment, raised} = exit(child, {mode: childMode, environment, raised}));
    }
  }

  // execute exit actions
  for (const action of state.exitActions) {
    ({environment, raised} = execAction(action, {environment, raised}));
  }

  return {environment, raised};
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
        raised: {
          ...rt.raised,
          internalEvents: [...rt.raised.internalEvents, action.event]},
      };
    }
    else {
      // append to output events
      return {
        ...rt,
        raised: {
          ...rt.raised,
          outputEvents: [...rt.raised.outputEvents, action.event],
        },
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
    const argA = evalExpr(expr.lhs, environment);
    const argB = evalExpr(expr.rhs, environment);
    return BINARY_OPERATOR_MAP.get(expr.operator)!(argA,argB);
  }
  throw new Error("should never reach here");
}

