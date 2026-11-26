// The types defined in this module reflect the parser rules in ./grammar.txt

import { TextRange, Lhs, Assignment, BaseExpression, UnaryExpression, BinaryExpression, ArrayExpression, DictExpression, FunctionCall, Literal, VarRef, visitExpression } from "../../actionlang/abstract_syntax";

export type ParsedText = TransitionLabel | Comment | Tag | ParserError;

export type TransitionLabel = {
  kind: "transitionLabel";
  uid: string; // uid of the text node
  trigger: Trigger;
  guard: SCExpression;
  actions: Action[];
}

export type Comment = {
  kind: "comment";
  uid: string; // uid of the text node
  text: string;
  range: TextRange;
}

export type Tag = {
  kind: "tag";
  uid: string; // uid of the text node
  text: string;
  range: TextRange;
}

export type ParserError = {
  kind: "parserError";
  uid: string; // uid of the text node
}

export type Trigger = TriggerLess | EventTrigger | AfterTrigger | EntryTrigger | ExitTrigger;

export type TriggerLess = {
  kind: "triggerless";
}

export type EventTrigger = {
  kind: "event";
  event: string;
  param?: Lhs;
}

export type AfterTrigger = {
  kind: "after";
  durationMs: number;
  rangeAfter: TextRange;
  rangeUnit: TextRange;
  rangeNumber: TextRange;
}

export type EntryTrigger = {
  kind: "entry";
  range: TextRange;
}
export type ExitTrigger = {
  kind: "exit";
  range: TextRange;
}

export type Action = Assignment<SCExpression> | RaiseEvent;

export type RaiseEvent = {
  kind: "raise";
  event: string;
  param?: SCExpression;
}

// We cannot use BaseExpression<SCExpression> here because that's a type alias and TypeScript doesn't allow recursive type aliases.
export type SCExpression = BinaryExpression<SCExpression> | UnaryExpression<SCExpression> | VarRef | Literal | FunctionCall<SCExpression> | DictExpression<SCExpression> | ArrayExpression<SCExpression> | TagExpr;

export type TagExpr = {
  kind: "tag";
  text: string;
  range?: TextRange,
}

export function visitSCExpression(expr: SCExpression, rec: (sub: SCExpression) => void) {
  if (expr.kind !== "tag") {
    visitExpression(expr, rec)
  }
}