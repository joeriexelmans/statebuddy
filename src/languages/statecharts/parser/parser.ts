import {  ConcreteState, HistoryState, OrState, UnstableState, AbstractSyntax, stateDescription, Transition, computeArena } from "../abstract_syntax";
import { parse as parseLabel, SyntaxError } from "../transitionlabel/parser";
import { Topology } from "./detect_topology";
import { memoize } from "@/util/util";
import { Expression, Lhs } from "../../actionlang/abstract_syntax";
import { ParsedText, Action } from "../transitionlabel/abstract_syntax";

export type TraceableError = {
  shapes: string[]; // the shape(s) in concrete syntax to which the error is related.
  message: string;
  data?: any; // optional auxilliary data the error can carry.
}

export const cachedParseLabel = memoize(parseLabel);

export function parseStatechart(topology: Topology): [AbstractSyntax, TraceableError[]] {
  const errors: TraceableError[] = [];
  const warnings: TraceableError[] = [];

  // implicitly, the root is always an Or-state
  const root: OrState = {
    kind: "or",
    uid: "root",
    children: [],
    history: [],
    initial: [],
    comments: [],
    tags: [],
    entryActions: [],
    exitActions: [],
    depth: 0,
    timers: [],
  }

  const uid2State = new Map<string, ConcreteState|UnstableState>([["root", root]]);

  const tag2States = new Map<string, [string, ConcreteState][]>(); // tag -> (text-uid, state)

  const historyStates: HistoryState[] = [];
  const parentLinks = new Map<string, string>();

  // step 1: figure out state hierarchy

  for (const [uid, kind] of topology.rountangles.entries()) {
    const parent = uid2State.get(topology.insidenessMap.get(uid)!)! as ConcreteState;
    const common = {
      kind,
      uid,
      comments: [],
      tags: [],
      entryActions: [],
      exitActions: [],
      parent,
      depth: parent.depth + 1,
    };
    let state;
    if (kind === "or") {
      state = {
        ...common,
        initial: [],
        children: [],
        history: [],
        timers: [],
      };
    }
    else if (kind === "and") {
      state = {
        ...common,
        children: [],
        history: [],
        timers: [],
      };
    }
    parent.children.push(state as ConcreteState);
    parentLinks.set(uid, parent.uid);
    uid2State.set(uid, state as ConcreteState);
  }
  for (const uid of topology.diamonds) {
    const parent = uid2State.get(topology.insidenessMap.get(uid)!)! as ConcreteState;
    const pseudoState = {
      kind: "pseudo" as const,
      uid,
      comments: [],
      tags: [],
      depth: parent.depth+1,
      parent,
      entryActions: [],
      exitActions: [],
    };
    uid2State.set(uid, pseudoState);
    parent.children.push(pseudoState);
  }
  for (const [uid, kind] of topology.history) {
    const parent = uid2State.get(topology.insidenessMap.get(uid)!)! as ConcreteState;
    const historyState = {
      kind,
      uid,
      parent,
      depth: parent.depth+1,
      comments: [],
      tags: [],
    };
    parent.history.push(historyState);
    historyStates.push(historyState);
  }

  // step 2: figure out transitions

  const transitions = new Map<string, Transition[]>();
  const uid2Transition = new Map<string, Transition>();

  for (const uid of topology.arrows) {
    const srcUID = topology.arrow2SideMap.get(uid)?.[0]?.uid;
    const tgtUID = topology.arrow2SideMap.get(uid)?.[1]?.uid;
    const historyTgtUID = topology.arrow2HistoryMap.get(uid);
    if (!srcUID) {
      if (historyTgtUID) {
        errors.push({shapes: [uid], message: "no source"});
      }
      else if (!tgtUID) {
        // dangling edge
        errors.push({shapes: [uid], message: "dangling"});
      }
      else {
        // target but no source, so we treat is as an 'initial' marking
        const tgtState = uid2State.get(tgtUID)!;
        if (tgtState.kind === "pseudo") {
          // maybe allow this in the future?
          errors.push({
            shapes: [uid],
            message: "pseudo-state cannot be initial state",
          });
        }
        else {
          const ofState = uid2State.get(parentLinks.get(tgtUID)!)!;
          if (ofState.kind === "or") {
            ofState.initial.push([uid, tgtState]);
          }
          else {
            // and states do not have an 'initial' state
            errors.push({
              shapes: [uid],
              message: "AND-state cannot have an initial state",
            });
          }
        }
      }
    }
    else {
      if (historyTgtUID || tgtUID) {
        // add transition
        let tgt;
        if (historyTgtUID) {
          tgt = historyStates.find(h => h.uid === historyTgtUID)!;
        }
        else {
          tgt = uid2State.get(tgtUID!)!;
        }
        const src = uid2State.get(srcUID)!;
        const transition: Transition = {
          uid: uid,
          src,
          tgt,
          arena: computeArena(src, tgt),
          label: [],
        }
        const existingTransitions = transitions.get(srcUID) || [];
        existingTransitions.push(transition);
        transitions.set(srcUID, existingTransitions);
        uid2Transition.set(uid, transition);
      }
      else {
        errors.push({
          shapes: [uid],
          message: "no target",
        });
      }
    }
  }

  for (const state of uid2State.values()) {
    if (state.kind === "or") {
      if (state.initial.length > 1) {
        errors.push({
          shapes: state.initial.map(([uid]) => uid),
          message: "multiple initial states",
        });
      }
      else if (state.initial.length === 0) {
        errors.push({
          shapes: [state.uid], 
          message: "needs initial state",
        });
      }
    }
  }

  let variables = new Set<string>();
  const inputEvents = new Set<string>();
  const internalEvents = new Set<string>();
  const outputEvents = new Set<string>();

  // step 3: figure out labels

  // ASSUMPTION: text is sorted by y-coordinate
  for (const [uid, text] of topology.texts) {
    let parsed: ParsedText;
    try {
      parsed = cachedParseLabel(text); // may throw
      parsed.uid = uid;
    } catch (e) {
      if (e instanceof SyntaxError) {
        errors.push({
          shapes: [uid],
          message: 'parser: ' + e.message,
          data: e,
        });
        parsed = {
          kind: "parserError",
          uid: uid,
        }
      }
      else {
        throw e;
      }
    }
    const belongsToArrowUID = topology.text2ArrowMap.get(uid);
    const belongsToTransition = uid2Transition.get(belongsToArrowUID!);
    if (belongsToTransition) {
      const {src} = belongsToTransition;
      belongsToTransition.label.push(parsed);
      if (parsed.kind === "transitionLabel") {
        // collect events
        // triggers
        if (parsed.trigger.kind === "event") {
          if (src.kind === "pseudo") {
            errors.push({shapes: [uid], message: "cannot have trigger"});
          }
          else {
            const {event} = parsed.trigger;
            if (event.startsWith("_")) {
              internalEvents.add(event);
            }
            else {
              inputEvents.add(event);
            }
          }
        }
        else if (parsed.trigger.kind === "after") {
          if (src.kind === "pseudo") {
            errors.push({shapes: [uid], message: "cannot have trigger"});
          }
          else {
            src.timers.push(parsed.trigger.durationMs);
            src.timers.sort();
          }
        }
        else if (["entry", "exit"].includes(parsed.trigger.kind)) {
          errors.push({shapes: [uid], message: "entry/exit trigger not allowed on transitions"});
        }
        else if (parsed.trigger.kind === "triggerless") {
          if (src.kind !== "pseudo") {
            errors.push({shapes: [uid], message: "needs trigger"});
          }
        }
      }
    }
    else {
      // text does not belong to transition...
      // so it belongs to a rountangle (a state)
      const rountangleUID = topology.text2RountangleMap.get(uid);
      const belongsToState = uid2State.get(rountangleUID!) as ConcreteState || root;
      if (parsed.kind === "transitionLabel") {
        // labels belonging to a rountangle (= a state) must by entry/exit actions
        // if we cannot find a containing state, then it belong to the root
        if (parsed.trigger.kind === "entry") {
          belongsToState.entryActions.push(...parsed.actions);
        }
        else if(parsed.trigger.kind === "exit") {
          belongsToState.exitActions.push(...parsed.actions);
        }
        else {
          errors.push({
            shapes: [uid],
            message: "must belong to transition",
            data: {start: {offset: 0}, end: {offset: text.length}},
          });
        }
      }
      else if (parsed.kind === "comment") {
        // just append comments to their respective states
        belongsToState.comments.push([uid, parsed.text]);
      }
      else if (parsed.kind === "tag") {
        const states = tag2States.get(parsed.text) || [];
        states.push([parsed.uid, belongsToState]);
        tag2States.set(parsed.text, states);
      }
    }

    if (parsed.kind === "transitionLabel") {
      // collect output events
      for (const action of parsed.actions) {
        if (action.kind === "raise") {
          const {event} = action;
          if (event.startsWith("_")) {
            internalEvents.add(event);
          }
          else {
            outputEvents.add(event);
          }
        }
      }
      // collect variables
      variables = variables.union(findVariables(parsed.guard));
      for (const action of parsed.actions) {
        variables = variables.union(findVariablesAction(action));
      }
    }
  }

  for (const transition of uid2Transition.values()) {
    if (transition.label.length === 0) {
      errors.push({
        shapes: [transition.uid],
        message: "no label",
      });
    }
    else if (transition.label.length > 1) {
      errors.push({
        shapes: [transition.uid],
        message: "multiple labels",
      });
    }
  }

  // sort children by their label
  for (const state of uid2State.values()) {
    if (state.kind === "and") {
      state.children.sort((a, b) => stateDescription(a).localeCompare(stateDescription(b)));
    }
  }

  for (const [tag, states] of tag2States) {
    if (states.length >= 2) {
      errors.push({
        message: "duplicate ID",
        shapes: states.map(([textUid, _state]) => textUid),
      });
    }
    else {
      const [[textUid, state]] = states;
      state.tags.push([textUid, tag]);
    }
  }

  const tag2State = new Map([...tag2States]
    .filter(([_, states]) => states.length === 1)
    .map(([tag, [[textUid, state]]]) => [tag, state] as const));
  
  return [{
    root,
    transitions,
    variables,
    inputEvents,
    internalEvents,
    outputEvents,
    uid2State,
    tag2State,
    historyStates,
  }, errors];
}

function findVariables(expr: Expression): Set<string> {
  if (expr.kind === "ref") {
    return new Set([expr.variable]);
  }
  else if (expr.kind === "unaryExpr") {
    return findVariables(expr.expr);
  }
  else if (expr.kind === "binaryExpr") {
    return findVariables(expr.lhs).union(findVariables(expr.rhs));
  }
  return new Set();
}

// find all variable names mentioned in Actions
function findVariablesAction(action: Action): Set<string> {
  if (action.kind === "assignment") {
    return new Set([...findVariablesLhs(action.lhs), ...findVariables(action.rhs)]);
  }
  return new Set();
}

function findVariablesLhs(lhs: Lhs): Set<string> {
  if (lhs.kind === "lhsRef") {
    return new Set([lhs.variable]);
  }
  else if (lhs.kind === "lhsLiteral") {
    return new Set();
  }
  else if (lhs.kind === "lhsArray") {
    return new Set(lhs.elements.flatMap(el => [...findVariablesLhs(el)]));
  }
  else if (lhs.kind === "lhsDict") {
    return new Set(Object.values(lhs.fields).flatMap(el => [...findVariablesLhs(el)]));
  }
  throw new Error("unreachable");
}
