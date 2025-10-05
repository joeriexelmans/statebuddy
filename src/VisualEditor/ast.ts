export type AbstractState = {
  uid: string;
  children: ConcreteState[];
}

export type AndState = {
  kind: "and";
} & AbstractState;

export type OrState = {
  kind: "or";
  // array of tuples: (uid of Arrow indicating initial state, initial state)
  // in a valid AST, there must be one initial state, but we allow the user to draw crazy shit
  initial: [string, ConcreteState][]; 
} & AbstractState;

export type ConcreteState = AndState | OrState;

export type Transition = {
  uid: string;
  src: ConcreteState;
  tgt: ConcreteState;
  trigger: Trigger;
  guard: Expression;
  actions: Action[];
}

export type EventTrigger = {
  kind: "event";
  event: string;
}

export type AfterTrigger = {
  kind: "after";
  delay_ms: number;
}

export type Trigger = EventTrigger | AfterTrigger;

export type RaiseEvent = {
  kind: "raise";
  event: string;
}

export type Assign = {
  lhs: string;
  rhs: Expression;
}

export type Expression = {};

export type Action = RaiseEvent | Assign;

export type Statechart = {
  root: ConcreteState;
  transitions: Map<string, Transition[]>; // key: source state uid
}
