import { Action, EventTrigger, ParsedText } from "./label_ast";

export type AbstractState = {
  uid: string;
  parent?: ConcreteState;
  comments: [string, string][]; // array of tuple (text-uid, text-text)
  entryActions: Action[];
  exitActions: Action[];
  depth: number;
}

export type StableState = {
  kind: "and" | "or";
  children: ConcreteState[];
  history: HistoryState[];
  timers: number[]; // list of timeouts (e.g., the state having an outgoing transition with trigger "after 4s" would appear as the number 4000 in this list)
} & AbstractState;

export type AndState = {
  kind: "and";
} & StableState;

export type OrState = {
  kind: "or";
  // array of tuples: (uid of Arrow indicating initial state, initial state)
  // in a valid AST, there must be one initial state, but we allow the user to draw crazy shit
  initial: [string, ConcreteState][]; 
} & StableState;

export type PseudoState = {
  kind: "pseudo";
  uid: string;
  comments: [string, string][];
};

export type HistoryState = {
  kind: "shallow" | "deep";
  parent: ConcreteState;
  uid: string;
  depth: number;
}

export type ConcreteState = AndState | OrState;

export type Transition = {
  uid: string; // uid of arrow in concrete syntax
  src: ConcreteState | PseudoState;
  tgt: ConcreteState | PseudoState | HistoryState;
  label: ParsedText[];
}

export type Statechart = {
  root: OrState;
  transitions: Map<string, Transition[]>; // key: source state uid

  variables: Set<string>;

  inputEvents: EventTrigger[];
  internalEvents: EventTrigger[];
  outputEvents: Set<string>;

  uid2State: Map<string, ConcreteState|PseudoState>;

  historyStates: HistoryState[];
}

const emptyRoot: OrState = {
  uid: "root",
  kind: "or",
  depth: 0,
  initial: [],
  children:[],
  history: [],
  comments: [],
  entryActions: [],
  exitActions: [],
  timers: [],
};

export const emptyStatechart: Statechart = {
  root: emptyRoot,
  transitions: new Map(),
  variables: new Set(),
  inputEvents: [],
  internalEvents: [],
  outputEvents: new Set(),
  uid2State: new Map([["root", emptyRoot]]),
  historyStates: [],
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


export function computeLCA(a: (ConcreteState|HistoryState), b: (ConcreteState|HistoryState)): (ConcreteState|HistoryState) {
  if (a === b) {
    return a;
  }
  if (a.depth > b.depth) {
    return computeLCA(a.parent!, b);
  }
  return computeLCA(a, b.parent!);
}

export function computeLCA2(states: (ConcreteState|HistoryState)[]): (ConcreteState|HistoryState) {
  if (states.length === 0) {
    throw new Error("cannot compute LCA of empty set of states");
  }
  if (states.length === 1) {
    return states[0];
  }
  // 2 states or more
  return states.reduce((acc, cur) => computeLCA(acc, cur));
}

export function getPossibleTargets(t: Transition, ts: Map<string, Transition[]>): (ConcreteState|HistoryState)[] {
  if (t.tgt.kind !== "pseudo") {
    return [t.tgt];
  }
  const pseudoOutgoing = ts.get(t.tgt.uid) || [];
  return pseudoOutgoing.flatMap(t => getPossibleTargets(t, ts));
}

export function computeArena2(t: Transition, ts: Map<string, Transition[]>): OrState {
  const tgts = getPossibleTargets(t, ts);
  let lca = computeLCA2([t.src as ConcreteState, ...tgts]);
  while (lca.kind !== "or" || lca === t.src || lca === t.tgt) {
    lca = lca.parent!;
  }
  return lca as OrState;
}

// Assuming ancestor is already entered, what states to enter in order to enter descendants?
// E.g.
//    root > A > B > C > D
//  computePath({ancestor: A, descendant: A}) = []
//  computePath({ancestor: A, descendant: C}) = [B, C]
export function computePath({ancestor, descendant}: {ancestor: ConcreteState, descendant: (ConcreteState|HistoryState)}): (ConcreteState|HistoryState)[] {
  if (ancestor === descendant) {
    return [];
  }
  return [...computePath({ancestor, descendant: descendant.parent!}), descendant];
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
        return {arena: tgt as OrState, srcPath: path, tgtPath: [tgt]};
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
export function stateDescription(state: ConcreteState | PseudoState | HistoryState): string {
  if (state.kind === "shallow") {
    return `shallow(${stateDescription(state.parent)})`;
  }
  else if (state.kind === "deep") {
    return `deep(${stateDescription(state.parent)})`;
  }
  else {
    // @ts-ignore
    const description = state.comments.length > 0 ? state.comments[0][1] : state.uid;
    return description;
  }
}

export function transitionDescription(t: Transition) {
  return stateDescription(t.src) + ' ➔ ' + stateDescription(t.tgt);
}

