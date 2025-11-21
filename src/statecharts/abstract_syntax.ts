import { Action, EventTrigger, ParsedText } from "./label_ast";

export type AbstractState = {
  kind: string;
  uid: string;
  parent?: ConcreteState;
  depth: number;
  comments: [string, string][]; // array of tuple (text-uid, text-text)
}

export type EntryExitState = AbstractState & {
  entryActions: Action[];
  exitActions: Action[];
}

export type StableState = EntryExitState & {
  kind: "and" | "or";
  children: ConcreteState[];
  history: HistoryState[];
  timers: number[]; // list of timeouts (e.g., the state having an outgoing transition with trigger "after 4s" would appear as the number 4000 in this list)
};

export type AndState = {
  kind: "and";
} & StableState;

export type OrState = {
  kind: "or";
  // array of tuples: (uid of Arrow indicating initial state, initial state)
  // in a valid AST, there must be one initial state, but we allow the user to draw crazy shit
  initial: [string, ConcreteState][]; 
} & StableState;

export type ConcreteState = AndState | OrState;

export type TransitionSrcTgt = ConcreteState | UnstableState;

// also called pseudo-state or choice-state:
export type UnstableState = EntryExitState & {
  kind: "pseudo";
} & AbstractState;

export type HistoryState = AbstractState & {
  kind: "shallow" | "deep";
}


export type Transition = {
  uid: string; // uid of arrow in concrete syntax
  src: ConcreteState | UnstableState;
  tgt: ConcreteState | UnstableState | HistoryState;
  label: ParsedText[];
}

export type Statechart = {
  root: OrState;
  transitions: Map<string, Transition[]>; // key: source state uid

  variables: Set<string>;

  inputEvents: EventTrigger[];
  internalEvents: EventTrigger[];
  outputEvents: Set<string>;

  uid2State: Map<string, ConcreteState|UnstableState>;

  label2State: Map<string, ConcreteState>;

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
  label2State: new Map([]),
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


export function computeLCA(a: AbstractState, b: AbstractState): AbstractState {
  if (a === b) {
    return a;
  }
  if (a.depth > b.depth) {
    return computeLCA(a.parent!, b);
  }
  return computeLCA(a, b.parent!);
}

// arena(a,b) = lowest common or-state ancestor of (a,b) that is not a or b
// see "Deconstructing the Semantics of Big-Step Modelling Languages" by Shahram Esmaeilsabzali, 2009
export function computeArena(a: AbstractState, b: AbstractState): OrState {
  let arena = computeLCA(a, b);
  while (arena.kind !== "or" || arena.uid === a.uid || arena.uid === b.uid) {
    arena = arena.parent!;
  }
  return arena as OrState;
}

// Assuming ancestor is already entered, what states to enter in order to enter descendants?
// E.g.
//    root > A > B > C > D
//  computePath({ancestor: A, descendant: A}) = []
//  computePath({ancestor: A, descendant: C}) = [B, C]
export function computePath({ancestor, descendant}: {ancestor: AbstractState, descendant: AbstractState}): AbstractState[] {
  if (ancestor === descendant) {
    return [];
  }
  return [...computePath({ancestor, descendant: descendant.parent!}), descendant];
}

// transitive, reflexive
export function getDescendants(state: ConcreteState): Set<string> {
  const result = new Set([state.uid]);
  if (state.children) {
    for (const child of state.children) {
      for (const descendant of getDescendants(child)) {
        // will include child itself:
        result.add(descendant);
      }
    }
  }
  return result;
}

// the 'description' of a state is a human-readable string that (hopefully) identifies the state.
// if the state contains a comment, we take the 'first' (= visually topmost) comment
// otherwise we fall back to the state's UID.
export function stateDescription(state: AbstractState): string {
  if (state.kind === "shallow") {
    return `shallow(${stateDescription(state.parent!)})`;
  }
  else if (state.kind === "deep") {
    return `deep(${stateDescription(state.parent!)})`;
  }
  else if (state.comments.length > 0) {
    return state.comments[0][1];
  }
  else {
    return state.uid;
  }
}

export function transitionDescription(t: Transition) {
  return stateDescription(t.src) + ' ➔ ' + stateDescription(t.tgt);
}

