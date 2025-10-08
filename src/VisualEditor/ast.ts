import { Action, TransitionLabel } from "./label_ast";

export type AbstractState = {
  uid: string;
  parent?: ConcreteState;
  children: ConcreteState[];
  comments: [string, string][]; // array of tuple (text-uid, text-text)
  entryActions: Action[];
  exitActions: Action[];
  depth: number;
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

  uid2State: Map<string, ConcreteState>;
}

export const emptyStatechart: Statechart = {
  root: {
    uid: "root",
    kind: "or",
    initial: [],
    children:[],
    comments: [],
    entryActions: [],
    exitActions: [],
  },
  transitions: new Map(),
  variables: new Set(),
  inputEvents: new Set(),
  internalEvents: new Set(),
  outputEvents: new Set(),
};

// reflexive, transitive relation
export function isAncestorOf({ancestor, descendant}: {ancestor: ConcreteState, descendant: ConcreteState}): ConcreteState[] | false {
  if (ancestor.uid === descendant.uid) {
    return [descendant];
  }
  if (ancestor.depth >= descendant.depth) {
    return false;
  }
  const pathToParent = isAncestorOf({ancestor, descendant: descendant.parent!});
  return pathToParent && [...pathToParent, descendant];
}

// the arena of a transition is the lowest common ancestor state that is an OR-state
// see "Deconstructing the Semantics of Big-Step Modelling Languages" by Shahram Esmaeilsabzali, 2009
export function computeArena({src, tgt}: {src: ConcreteState, tgt: ConcreteState}): {
  arena: ConcreteState,
  srcPath: ConcreteState[],
  tgtPath: ConcreteState[],
} {
  if (src.depth >= tgt.depth) {
    const path = isAncestorOf({descendant: src, ancestor: tgt});
    if (path) {
      if (tgt.kind === "or") {
        return {arena: tgt, srcPath: path, tgtPath: [tgt]};
      }
    }
    // keep looking
    const {arena, srcPath, tgtPath} = computeArena({src, tgt: tgt.parent!});
    return {arena, srcPath, tgtPath: [...tgtPath, tgt]};
  }
  else {
    // same, but swap src and tgt
    const {arena, srcPath, tgtPath} = computeArena({src: tgt, tgt: src});
    return {arena, srcPath: tgtPath, tgtPath: srcPath};
  }
  throw new Error("should never reach here");
}
