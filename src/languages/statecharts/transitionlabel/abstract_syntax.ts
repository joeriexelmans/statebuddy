// The types defined in this module reflect the parser rules in ./grammar.txt

import { Expression, TextRange, Lhs } from "../../actionlang/abstract_syntax";

export type ParsedText = TransitionLabel | Comment | Tag | ParserError;

export type TransitionLabel = {
  kind: "transitionLabel";
  uid: string; // uid of the text node
  trigger: Trigger;
  guard: Expression;
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

export type Action = Assignment | RaiseEvent;

export type Assignment = {
  kind: "assignment";
  lhs: Lhs;
  rhs: Expression;
}

export type RaiseEvent = {
  kind: "raise";
  event: string;
  param?: Expression;
}
