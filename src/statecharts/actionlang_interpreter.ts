// Just a simple recursive interpreter for the action language

import { Expression } from "./label_ast";
import { Environment } from "./runtime_types";

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

export function evalExpr(expr: Expression, environment: Environment): any {
  if (expr.kind === "literal") {
    return expr.value;
  }
  else if (expr.kind === "ref") {
    const found = environment.get(expr.variable);
    if (found === undefined) {
      console.log({environment});
      throw new Error(`variable '${expr.variable}' does not exist in environment`);
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
    return BINARY_OPERATOR_MAP.get(expr.operator)!(lhs, rhs);
  }
  else if (expr.kind === "call") {
    const fn = evalExpr(expr.fn, environment);
    const param = evalExpr(expr.param, environment);
    return fn(param);
  }
  throw new Error("should never reach here");
}
