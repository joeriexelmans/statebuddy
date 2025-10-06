import { act } from "react";
import { ConcreteState, OrState, Statechart, Transition } from "./ast";
import { findNearestArrow, findNearestRountangleSide, Rountangle, VisualEditorState } from "./editor_types";
import { isEntirelyWithin, transformLine } from "./geometry";
import { Action, Expression, TransitionLabel } from "./label_ast";

import { parse as parseLabel, SyntaxError } from "./label_parser";

export function parseStatechart(state: VisualEditorState): [Statechart, [string,string][]] {
  const errorShapes: [string, string][] = [];

  // implicitly, the root is always an Or-state
  const root: OrState = {
    kind: "or",
    uid: "root",
    children: [],
    initial: [],
  }

  const uid2State = new Map<string, ConcreteState>([["root", root]]);

  // we will always look for the smallest parent rountangle
  const parentCandidates: Rountangle[] = [{
    kind: "or",
    uid: root.uid,
    topLeft: {x: -Infinity, y: -Infinity},
    size: {x: Infinity, y: Infinity},
  }];

  const parentLinks = new Map<string, string>();

  // step 1: figure out state hierarchy

  // we assume that the rountangles are sorted from big to small:
  for (const rt of state.rountangles) {
    const state: ConcreteState = {
      kind: rt.kind,
      uid: rt.uid,
      children: [],
    }
    if (state.kind === "or") {
      state.initial = [];
    }
    uid2State.set(rt.uid, state);

    // iterate in reverse:
    for (let i=parentCandidates.length-1; i>=0; i--) {
      const candidate = parentCandidates[i];
      if (candidate.uid === "root" || isEntirelyWithin(rt, candidate)) {
        // found our parent :)
        const parentState = uid2State.get(candidate.uid);
        parentState!.children.push(state);
        parentCandidates.push(rt);
        parentLinks.set(rt.uid, candidate.uid);
        break;
      }
    }
  }

  // step 2: figure out transitions

  const transitions = new Map<string, Transition[]>();
  const uid2Transition = new Map<string, Transition>();

  for (const arr of state.arrows) {
    const srcUID = findNearestRountangleSide(arr, "start", state.rountangles)?.uid;
    const tgtUID = findNearestRountangleSide(arr, "end", state.rountangles)?.uid;
    if (!srcUID) {
      if (!tgtUID) {
        // dangling edge - todo: display error...
        errorShapes.push([arr.uid, "dangling"]);
      }
      else {
        // target but no source, so we treat is as an 'initial' marking
        const initialState = uid2State.get(tgtUID)!;
        const ofState = uid2State.get(parentLinks.get(tgtUID)!)!;
        if (ofState.kind === "or") {
          ofState.initial.push([arr.uid, initialState]);
        }
        else {
          // and states do not have an 'initial' state - todo: display error...
          errorShapes.push([arr.uid, "AND-state cannot have an initial state"]);
        }
      }
    }
    else {
      if (!tgtUID) {
        errorShapes.push([arr.uid, "no target"]);
      }
      else {
        // add transition
        const transition: Transition = {
          uid: arr.uid,
          src: uid2State.get(srcUID)!,
          tgt: uid2State.get(tgtUID)!,
          label: [],
        };
        const existingTransitions = transitions.get(srcUID) || [];
        existingTransitions.push(transition);
        transitions.set(srcUID, existingTransitions);
        uid2Transition.set(arr.uid, transition);
      }
    }
  }

  for (const state of uid2State.values()) {
    if (state.kind === "or") {
      if (state.initial.length > 1) {
        errorShapes.push(...state.initial.map(([uid,childState])=>[uid,"multiple initial states"] as [string, string]));
      }
      else if (state.initial.length === 0) {
        errorShapes.push([state.uid, "no initial state"]);
      }
    }
  }

  let variables = new Set<string>();
  const inputEvents = new Set<string>();
  const outputEvents = new Set<string>();
  const internalEvents = new Set<string>();

  // step 3: figure out labels

  for (const text of state.texts) {
    const belongsToArrow = findNearestArrow(text.topLeft, state.arrows);
    if (belongsToArrow) {
      const belongsToTransition = uid2Transition.get(belongsToArrow.uid);
      if (belongsToTransition) {
        // parse as transition label
        let transitionLabel: TransitionLabel;
        try {
          transitionLabel = parseLabel(text.text); // may throw
          belongsToTransition.label.push(transitionLabel);
          // collect events
          if (transitionLabel.trigger.kind === "event") {
            const {event} = transitionLabel.trigger;
            if (event.startsWith("_")) {
              internalEvents.add(event);
            }
            else {
              inputEvents.add(event);
            }
          }
          for (const action of transitionLabel.actions) {
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
          variables = variables
            .union(findVariables(transitionLabel.guard));
          for (const action of transitionLabel.actions) {
            variables = variables.union(findVariablesAction(action));
          }
        }
        catch (e) {
          if (e instanceof SyntaxError) {
            belongsToTransition.label.push(null);
            errorShapes.push([text.uid, e]);
          }
          else {
            throw e;
          }
        }
      }
    }
  }

  for (const transition of uid2Transition.values()) {
    if (transition.label.length === 0) {
      errorShapes.push([transition.uid, "no label"]);
    }
    else if (transition.label.length > 1) {
      errorShapes.push([transition.uid, "multiple labels"]);
    }
  }

  return [{
    root,
    transitions,
    variables,
    inputEvents,
    internalEvents,
    outputEvents,
  }, errorShapes];
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
  else if (expr.kind === "literal") {
    return new Set();
  }
}

function findVariablesAction(action: Action): Set<string> {
  if (action.kind === "assignment") {
    return new Set([action.lhs, ...findVariables(action.rhs)]);
  }
  return new Set();
}

