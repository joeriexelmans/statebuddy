export type ParsedText = TransitionLabel | Comment;

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
}

export type Trigger = EventTrigger | AfterTrigger | EntryTrigger | ExitTrigger;

export type EventTrigger = {
  kind: "event";
  event: string;
}

export type AfterTrigger = {
  kind: "after";
  durationMs: number;
}

export type EntryTrigger = {
  kind: "entry";
}
export type ExitTrigger = {
  kind: "exit";
}


export type Action = Assignment | RaiseEvent;

export type Assignment = {
  kind: "assignment";
  lhs: string;
  rhs: Expression;
}

export type RaiseEvent = {
  kind: "raise";
  event: string;
}


export type Expression = BinaryExpression | UnaryExpression | VarRef | Literal;

export type BinaryExpression = {
  kind: "binaryExpr";
  operator: "+" | "-" | "*" | "/" | "&&" | "||";
  lhs: Expression;
  rhs: Expression;
}

export type UnaryExpression = {
  kind: "unaryExpr";
  operator: "!" | "-";
  expr: Expression;
}

export type VarRef = {
  kind: "ref";
  variable: string;
}

export type Literal = {
  kind: "literal";
  value: any;
}