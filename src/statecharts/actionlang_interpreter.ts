// Just a simple recursive interpreter for the action language

import { jsonDeepEqual } from "@/util/util";
import { Environment, Scope } from "./environment";
import { RuntimeError } from "./interpreter";
import { Assignment, Expression, Lhs } from "./label_ast";
import { Tracer } from "./tracer";

const UNARY_OPERATOR_MAP: Map<string, (x: any) => any> = new Map([
  ["!", x => !x],
  ["-", x => -x as any],
]);
const BINARY_OPERATOR_MAP: Map<string, (a: any, b: any) => any> = new Map([
  ["+", (a, b) => a + b],
  ["-", (a, b) => a - b],
  ["*", (a, b) => a * b],
  ["/", (a, b) => a / b],
  ["&&", (a, b) => a && b],
  ["||", (a, b) => a || b],
  ["==", (a, b) => a == b],
  ["<=", (a, b) => a <= b],
  [">=", (a, b) => a >= b],
  ["<", (a, b) => a < b],
  [">", (a, b) => a > b],
  ["%", (a, b) => a % b],
]);

// parameter uids: list of UIDs to append to any raised errors
export function evalExpr(expr: Expression, env: Environment, uids: string[] = []): any {
  if (expr.kind === "literal") {
    return expr.value;
  }
  else if (expr.kind === "ref") {
    // @ts-ignore
    const found = env.get(expr.variable);
    if (found === undefined) {
      console.log({env});
      throw new RuntimeError(`variable '${expr.variable}' does not exist in environment`, uids);
    }
    return found;
  }
  else if (expr.kind === "unaryExpr") {
    const arg = evalExpr(expr.expr, env, uids);
    return UNARY_OPERATOR_MAP.get(expr.operator)!(arg);
  }
  else if (expr.kind === "binaryExpr") {
    const lhs = evalExpr(expr.lhs, env, uids);
    const rhs = evalExpr(expr.rhs, env, uids);
    return BINARY_OPERATOR_MAP.get(expr.operator)!(lhs, rhs);
  }
  else if (expr.kind === "call") {
    const fn = evalExpr(expr.fn, env, uids);
    const param = evalExpr(expr.param, env, uids);
    return fn(param);
  }
  else if (expr.kind === "array") {
    return expr.elements.map(el => evalExpr(el, env, uids));
  }
  else if (expr.kind === "dict") {
    return Object.fromEntries(Object.entries(expr.fields).map(([key,val]) => [key, evalExpr(val, env, uids)]));
  }
  console.error('expr was', expr);
  throw new Error("should never reach here");
}

// Similar to evalExpr, this function recursively does a destructuring assignment of a given value on a given LHS.
export function execAssignment(
  lhs: Lhs,
  rhsValue: any, // <-- the already evaluated RHS
  env: Environment,
  scope: Scope,
  uids: string[] = [],
  tracer: Tracer,
): Environment {
  if (lhs.kind === "lhsRef") {
    console.log(`assign ${lhs.variable} = ${JSON.stringify(rhsValue)}`, lhs, rhsValue);
    tracer.log(`assign ${lhs.variable} = ${JSON.stringify(rhsValue)}`);
    return env.set(lhs.variable, rhsValue, scope);
  }
  else if (lhs.kind === "lhsLiteral") {
    // when encountering value on LHS, we treat it as an assertion that it must equal the RHS
    if (!jsonDeepEqual(lhs.value, rhsValue)) {
      throw new RuntimeError(`assertion failed: ${JSON.stringify(lhs.value)} != ${JSON.stringify(rhsValue)}`, uids);
    }
    // and it doesn't do anything
    return env;
  }
  else if (lhs.kind === "lhsArray") {
    if (!Array.isArray(rhsValue)) {
      throw new RuntimeError(`cannot destructure ${JSON.stringify(rhsValue)} into array`, uids);
    }
    if (lhs.elements.length > rhsValue.length) {
      throw new RuntimeError(`destructuring array: not enough elements in RHS: ${JSON.stringify(rhsValue)}`, uids);
    }
    for (let i=0; i<lhs.elements.length; i++) {
      // perform nested assignments element-wise
      env = execAssignment(lhs.elements[i], rhsValue[i], env, scope, uids, tracer);
    }
    return env;
  }
  else if (lhs.kind === "lhsDict") {
    // accidental  complexity of checking if a value is a regular object in JS:
    if (!rhsValue || typeof rhsValue !== "object" || Array.isArray(rhsValue)) {
      throw new RuntimeError(`cannot destructure ${JSON.stringify(rhsValue)} into dictionary`, uids);
    }
    for (const [lhsKey, lhsLhs] of Object.entries(lhs.fields)) {
      if (!Object.hasOwn(rhsValue, lhsKey)) {
        throw new RuntimeError(`destructuring dictionary: missing key '${lhsKey} in RHS: ${JSON.stringify(rhsValue)}'`, uids);
      }
      env = execAssignment(lhsLhs, rhsValue[lhsKey], env, scope, uids, tracer);
    }
    return env;
  }
  console.error("lhs was", lhs);
  throw new Error("should never reach here");
}
