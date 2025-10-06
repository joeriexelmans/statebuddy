import { TransitionLabel } from "./label_ast";

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
  label: TransitionLabel[];
}

export type Statechart = {
  root: OrState;
  transitions: Map<string, Transition[]>; // key: source state uid

  variables: Set<string>;

  inputEvents: Set<string>;
  internalEvents: Set<string>;
  outputEvents: Set<string>;
}
