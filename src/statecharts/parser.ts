import { ConcreteState, OrState, Statechart, Transition } from "./abstract_syntax";
import { findNearestArrow, findNearestRountangleSide, findRountangle, Rountangle, VisualEditorState } from "./concrete_syntax";
import { isEntirelyWithin } from "../VisualEditor/geometry";
import { Action, EventTrigger, Expression, ParsedText } from "./label_ast";

import { parse as parseLabel, SyntaxError } from "./label_parser";

export type TraceableError = {
  shapeUid: string;
  message: string;
  data?: any;
}

function addEvent(events: EventTrigger[], e: EventTrigger, textUid: string) {
  const haveEvent = events.find(({event}) => event === e.event);
  if (haveEvent) {
    if (haveEvent.paramName !== e.paramName === undefined) {
      return [{
          shapeUid: textUid,
          message: "inconsistent event parameter",
      }];
    }
    return [];
  }
  else {
    events.push(e);
    events.sort((a,b) => a.event.localeCompare(b.event));
    return [];
  }
}

export function parseStatechart(state: VisualEditorState): [Statechart, TraceableError[]] {
  const errors: TraceableError[] = [];

  // implicitly, the root is always an Or-state
  const root: OrState = {
    kind: "or",
    uid: "root",
    children: [],
    initial: [],
    comments: [],
    entryActions: [],
    exitActions: [],
    depth: 0,
    timers: [],
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
    // @ts-ignore
    const state: ConcreteState = {
      kind: rt.kind,
      uid: rt.uid,
      children: [],
      comments: [],
      entryActions: [],
      exitActions: [],
      timers: [],
    };
    if (state.kind === "or") {
      (state as unknown as OrState).initial = [];
    }
    uid2State.set(rt.uid, (state));

    // iterate in reverse:
    for (let i=parentCandidates.length-1; i>=0; i--) {
      const candidate = parentCandidates[i];
      if (candidate.uid === "root" || isEntirelyWithin(rt, candidate)) {
        // found our parent :)
        const parentState = uid2State.get(candidate.uid)!;
        parentState.children.push(state as unknown as ConcreteState);
        parentCandidates.push(rt);
        parentLinks.set(rt.uid, candidate.uid);
        state.parent = parentState;
        state.depth = parentState.depth+1;
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
        errors.push({shapeUid: arr.uid, message: "dangling"});
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
          errors.push({
            shapeUid: arr.uid,
            message: "AND-state cannot have an initial state",
          });
        }
      }
    }
    else {
      if (!tgtUID) {
        errors.push({
          shapeUid: arr.uid,
          message: "no target",
        });
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
        errors.push(...state.initial.map(([uid,childState]) => ({
          shapeUid: uid,
          message: "multiple initial states",
        })));
      }
      else if (state.initial.length === 0) {
        errors.push({
          shapeUid: state.uid, 
          message: "no initial state",
        });
      }
    }
  }

  let variables = new Set<string>();
  const inputEvents: EventTrigger[] = [];
  const internalEvents: EventTrigger[] = [];
  const outputEvents = new Set<string>();

  // step 3: figure out labels

  const textsSorted = state.texts.toSorted((a,b) => a.topLeft.y - b.topLeft.y);
  for (const text of textsSorted) {
    let parsed: ParsedText;
    try {
      parsed = parseLabel(text.text); // may throw
      parsed.uid = text.uid;
    } catch (e) {
      if (e instanceof SyntaxError) {
        errors.push({
          shapeUid: text.uid,
          message: e.message,
          data: e,
        });
        parsed = {
          kind: "parserError",
          uid: text.uid,
        }
      }
      else {
        throw e;
      }
    }
    const belongsToArrow = findNearestArrow(text.topLeft, state.arrows);
    if (belongsToArrow) {
      const belongsToTransition = uid2Transition.get(belongsToArrow.uid);
      if (belongsToTransition) {
        belongsToTransition.label.push(parsed);
        if (parsed.kind === "transitionLabel") {
          // collect events
          // triggers
          if (parsed.trigger.kind === "event") {
            const {event} = parsed.trigger;
            if (event.startsWith("_")) {
              errors.push(...addEvent(internalEvents, parsed.trigger, parsed.uid));
            }
            else {
              errors.push(...addEvent(inputEvents, parsed.trigger, parsed.uid));
            }
          }
          else if (parsed.trigger.kind === "after") {
            belongsToTransition.src.timers.push(parsed.trigger.durationMs);
            belongsToTransition.src.timers.sort();
          }
          else if (["entry", "exit"].includes(parsed.trigger.kind)) {
            errors.push({shapeUid: text.uid, message: "entry/exit trigger not allowed on transitions"});
          }

          // // raise-actions
          // for (const action of parsed.actions) {
          //   if (action.kind === "raise") {
          //     const {event} = action;
          //     if (event.startsWith("_")) {
          //       internalEvents.add(event);
          //     }
          //     else {
          //       outputEvents.add(event);
          //     }
          //   }
          // }

          // collect variables
          variables = variables.union(findVariables(parsed.guard));
          for (const action of parsed.actions) {
            variables = variables.union(findVariablesAction(action));
          }
        }
      }
    }
    else {
      // text does not belong to transition...
      // so it belongs to a rountangle (a state)
      const rountangle = findRountangle(text.topLeft, state.rountangles);
      const belongsToState = rountangle ? uid2State.get(rountangle.uid)! : root;
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
            shapeUid: text.uid,
            message: "states can only have entry/exit triggers",
            data: {start: {offset: 0}, end: {offset: text.text.length}},
          });
        }

      }
      else if (parsed.kind === "comment") {
        // just append comments to their respective states
        belongsToState.comments.push([text.uid, parsed.text]);
      }
    }
  }

  for (const transition of uid2Transition.values()) {
    if (transition.label.length === 0) {
      errors.push({
        shapeUid: transition.uid,
        message: "no label",
      });
    }
    else if (transition.label.length > 1) {
      errors.push({
        shapeUid: transition.uid,
        message: "multiple labels",
      });
    }
  }

  return [{
    root,
    transitions,
    variables,
    inputEvents,
    internalEvents,
    outputEvents,
    uid2State,
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

function findVariablesAction(action: Action): Set<string> {
  if (action.kind === "assignment") {
    return new Set([action.lhs, ...findVariables(action.rhs)]);
  }
  return new Set();
}

