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

const emptyRoot: OrState = {
  uid: "root",
  kind: "or",
  depth: 0,
  initial: [],
  children:[],
  comments: [],
  entryActions: [],
  exitActions: [],
};

export const emptyStatechart: Statechart = {
  root: emptyRoot,
  transitions: new Map(),
  variables: new Set(),
  inputEvents: new Set(),
  internalEvents: new Set(),
  outputEvents: new Set(),
  uid2State: new Map([["root", emptyRoot]]),
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

export function isOverlapping(a: ConcreteState, b: ConcreteState): boolean {
  if (a.depth < b.depth) {
    return Boolean(isAncestorOf({ancestor: a, descendant: b}));
  }
  else {
    return Boolean(isAncestorOf({ancestor: b, descendant: a}));
  }
}

// the arena of a transition is the lowest common ancestor state that is an OR-state
// see "Deconstructing the Semantics of Big-Step Modelling Languages" by Shahram Esmaeilsabzali, 2009
export function computeArena({src, tgt}: {src: ConcreteState, tgt: ConcreteState}): {
  arena: OrState,
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
}

export function getDescendants(state: ConcreteState): Set<string> {
  const result = new Set([state.uid]);
  for (const child of state.children) {
    for (const descendant of getDescendants(child)) {
      // will include child itself:
      result.add(descendant);
    }
  }
  return result;
}

// the 'description' of a state is a human-readable string that (hopefully) identifies the state.
// if the state contains a comment, we take the 'first' (= visually topmost) comment
// otherwise we fall back to the state's UID.
export function stateDescription(state: ConcreteState) {
  const description = state.comments.length > 0 ? state.comments[0][1] : state.uid;
  return description;
}

