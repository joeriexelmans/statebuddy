import { evalExpr } from "@/languages/actionlang/interpreter";
import { Environment, Scope } from "../interpreter/environment";
import { SCExpression } from "./abstract_syntax";

export function evalSCExpr(expr: SCExpression, env: Environment, scope: Scope, uids: string[] = []): any {
  if (expr.kind === "tag") {
    return expr.text;
  }
  else {
    return evalExpr(expr, env, scope, uids, evalSCExpr);
  }
}
