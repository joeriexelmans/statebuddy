// Just a simple recursive interpreter for the action language

import { jsonDeepEqual } from "@/util/util";
import { Environment, Scope } from "../statecharts/interpreter/environment";
import { RuntimeError } from "../statecharts/interpreter/interpreter";
import { Expression, Lhs } from "./abstract_syntax";
import { TraceAssign } from "../statecharts/interpreter/trace_types";

function numericUnary(op: string, fn: (x: number) => any): (x: any) => any {
  return (x: any) => {
    if (typeof x !== "number") {
      throw new RuntimeError(`unary operator (${op}): argument must be a number`, []);
    }
    return fn(x);
  };
}

function numericBinary(op: string, fn: (a: number, b: number) => any): (a: any, b: any) => any {
  return (a: any, b: any) => {
    if (typeof a !== "number" || typeof b !== "number") {
      throw new RuntimeError(`(${op}) operator: both arguments must be numbers`, []);
    }
    return fn(a, b);
  };
}

function booleanBinary(op: string, fn: (a: boolean, b: boolean) => any): (a: any, b: any) => any {
  return (a: any, b: any) => {
    if (typeof a !== "boolean" || typeof b !== "boolean") {
      throw new RuntimeError(`(${op}) operator: both arguments must be booleans`, []);
    }
    return fn(a, b);
  };
}

const UNARY_OPERATOR_MAP: Map<string, (x: any) => any> = new Map([
  ["!", (x: any) => {
    if (typeof x !== "boolean") {
      throw new RuntimeError("unary operator (!): argument must be a boolean", []);
    }
    return !x;
  }],
  ["-", numericUnary("-", x => -x)],
]);

const BINARY_OPERATOR_MAP: Map<string, (a: any, b: any) => any> = new Map([
  // arithmetic
  ["+", numericBinary("+", (a, b) => a + b)],
  ["-", numericBinary("-", (a, b) => a - b)],
  ["*", numericBinary("*", (a, b) => a * b)],
  ["/", numericBinary("/", (a, b) => a / b)],
  ["%", numericBinary("%", (a, b) => a % b)],

  // comparison
  ["<",  numericBinary("<",  (a, b) => a < b)],
  [">",  numericBinary(">",  (a, b) => a > b)],
  ["<=", numericBinary("<=", (a, b) => a <= b)],
  [">=", numericBinary(">=", (a, b) => a >= b)],

  // logic
  ["&&", booleanBinary("&&", (a, b) => a && b)],
  ["||", booleanBinary("||", (a, b) => a || b)],

  // lists
  ["++", (a: any, b: any) => {
    if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
    if (typeof a === "string" && typeof b === "string") return a + b;
    throw new RuntimeError("(++) operator: both arguments must be lists or both must be strings", []);
  }],

  // equality works on any types, so no check
  ["==", (a: any, b: any) => a === b],
  ["!=", (a: any, b: any) => a !== b],
]);


// parameter uids: list of UIDs to append to any raised errors
export function evalExpr(expr: Expression, env: Environment, scope: Scope, uids: string[] = []): any {
  if (expr.kind === "literal") {
    return expr.value;
  }
  else if (expr.kind === "ref") {
    const found = env.get(expr.variable, scope);
    if (found === undefined) {
      console.log({env, scope});
      const err = new RuntimeError(`variable '${expr.variable}' does not exist in environment`, uids);
      console.error(err); // this way we see a stack trace
      throw err;
    }
    return found;
  }
  else if (expr.kind === "unaryExpr") {
    const arg = evalExpr(expr.expr, env, scope, uids);
    return UNARY_OPERATOR_MAP.get(expr.operator)!(arg);
  }
  else if (expr.kind === "binaryExpr") {
    const lhs = evalExpr(expr.lhs, env, scope, uids);
    const rhs = evalExpr(expr.rhs, env, scope, uids);
    return BINARY_OPERATOR_MAP.get(expr.operator)!(lhs, rhs);
  }
  else if (expr.kind === "call") {
    const fn = evalExpr(expr.fn, env, scope, uids);
    const param = evalExpr(expr.param, env, scope, uids);
    return fn(param);
  }
  else if (expr.kind === "array") {
    return expr.elements.map(el => evalExpr(el, env, scope, uids));
  }
  else if (expr.kind === "dict") {
    return new Map([...expr.fields].map(([key,val]) => [key, evalExpr(val, env, scope, uids)]));
  }
  else if (expr.kind === "tag") {
    return expr.text;
  }
  console.error('expr was', expr);
  throw new Error("should never reach here");
}

// Similar to evalExpr, this function recursively does a destructuring assignment of a given value on a given LHS.
export function execAssignment(
  lhs: Lhs,
  rhsValue: any, // <-- the already evaluated RHS (a javascript value)
  env: Environment,
  scope: Scope,
  uids: string[] = [],
  // tracer: Tracer,
): [Environment, TraceAssign[]] {
  if (lhs.kind === "lhsRef") {
    // console.log(`assign ${lhs.variable} = ${JSON.stringify(rhsValue)}`, lhs, rhsValue);
    if (rhsValue === undefined) {
      // tracer.log('runtime error');
      throw new RuntimeError(`missing value for '${lhs.variable}'`, uids);
    }
    // tracer.log(`assign ${scopeDescription(scope)}.${lhs.variable} = ${JSON.stringify(rhsValue)}`);
    return [env.set(lhs.variable, rhsValue, scope), [{variableName: lhs.variable, value: rhsValue}]];
  }
  else if (lhs.kind === "lhsLiteral") {
    // when encountering value on LHS, we treat it as an assertion that it must equal the RHS
    if (!jsonDeepEqual(lhs.value, rhsValue)) {
      throw new RuntimeError(`assertion failed: ${JSON.stringify(lhs.value)} != ${JSON.stringify(rhsValue)}`, uids);
    }
    // and it doesn't do anything
    return [env, []];
  }
  else if (lhs.kind === "lhsArray") {
    if (!Array.isArray(rhsValue)) {
      throw new RuntimeError(`cannot destructure ${JSON.stringify(rhsValue)} into array`, uids);
    }
    if (lhs.elements.length > rhsValue.length) {
      throw new RuntimeError(`destructuring array: not enough elements in RHS: ${JSON.stringify(rhsValue)}`, uids);
    }
    let actions: TraceAssign[] = [];
    for (let i=0; i<lhs.elements.length; i++) {
      // perform nested assignments element-wise
      let a;
      [env, a] = execAssignment(lhs.elements[i], rhsValue[i], env, scope, uids);
      actions = [...actions, ...a];
    }
    return [env, actions];
  }
  else if (lhs.kind === "lhsDict") {
    // accidental  complexity of checking if a value is a regular object in JS:
    if (!rhsValue || typeof rhsValue !== "object" || Array.isArray(rhsValue)) {
      throw new RuntimeError(`cannot destructure ${JSON.stringify(rhsValue)} into dictionary`, uids);
    }
    let actions: TraceAssign[] = [];
    for (const [lhsKey, lhsLhs] of Object.entries(lhs.fields)) {
      if (!Object.hasOwn(rhsValue, lhsKey)) {
        throw new RuntimeError(`destructuring dictionary: missing key '${lhsKey} in RHS: ${JSON.stringify(rhsValue)}'`, uids);
      }
      let a;
      [env, a] = execAssignment(lhsLhs, rhsValue[lhsKey], env, scope, uids);
      actions = [...actions, ...a];
    }
    return [env, actions];
  }
  console.error("lhs was", lhs);
  throw new Error("should never reach here");
}
