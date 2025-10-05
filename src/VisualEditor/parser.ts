import { ConcreteState, OrState, Statechart, Transition } from "./ast";
import { findNearestRountangleSide, Rountangle, VisualEditorState } from "./editor_types";
import { isEntirelyWithin } from "./geometry";

export function parseStatechart(state: VisualEditorState): [Statechart, [string,string][]] {
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

  const transitions = new Map<string, Transition[]>();

  const errorShapes: [string, string][] = [];

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
          trigger: {
            kind: "?",
          },
          guard: {},
          actions: [],
        };
        const existingTransitions = transitions.get(srcUID) || [];
        existingTransitions.push(transition);
        transitions.set(srcUID, existingTransitions);
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

  return [{
    root,
    transitions,
  }, errorShapes];
}