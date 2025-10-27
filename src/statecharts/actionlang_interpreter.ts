// Just a simple recursive interpreter for the action language

import { Environment } from "./environment";
import { RuntimeError } from "./interpreter";
import { Expression } from "./label_ast";

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
export function evalExpr(expr: Expression, environment: Environment, uids: string[] = []): any {
  if (expr.kind === "literal") {
    return expr.value;
  }
  else if (expr.kind === "ref") {
    const found = environment.get(expr.variable);
    if (found === undefined) {
      console.log({environment});
      throw new RuntimeError(`variable '${expr.variable}' does not exist in environment`, uids);
    }
    return found;
  }
  else if (expr.kind === "unaryExpr") {
    const arg = evalExpr(expr.expr, environment, uids);
    return UNARY_OPERATOR_MAP.get(expr.operator)!(arg);
  }
  else if (expr.kind === "binaryExpr") {
    const lhs = evalExpr(expr.lhs, environment, uids);
    const rhs = evalExpr(expr.rhs, environment, uids);
    return BINARY_OPERATOR_MAP.get(expr.operator)!(lhs, rhs);
  }
  else if (expr.kind === "call") {
    const fn = evalExpr(expr.fn, environment, uids);
    const param = evalExpr(expr.param, environment, uids);
    return fn(param);
  }
  throw new Error("should never reach here");
}
