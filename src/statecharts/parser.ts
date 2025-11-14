import {  ConcreteState, HistoryState, OrState, UnstableState, Statechart, stateDescription, Transition } from "./abstract_syntax";
import { Action, EventTrigger, Expression, ParsedText } from "./label_ast";
import { parse as parseLabel, SyntaxError } from "./label_parser";
import { Connections, ReducedConcreteSyntax } from "./detect_connections";
import { memoize } from "@/util/util";

export type TraceableError = {
  shapeUid: string;
  message: string;
  data?: any;
}

export const cachedParseLabel = memoize(parseLabel);

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

export function parseStatechart(concreteSyntax: ReducedConcreteSyntax, conns: Connections): [Statechart, TraceableError[]] {
  const errors: TraceableError[] = [];

  // implicitly, the root is always an Or-state
  const root: OrState = {
    kind: "or",
    uid: "root",
    children: [],
    history: [],
    initial: [],
    comments: [],
    entryActions: [],
    exitActions: [],
    depth: 0,
    timers: [],
  }

  const uid2State = new Map<string, ConcreteState|UnstableState>([["root", root]]);
  const label2State = new Map<string, ConcreteState>();
  const historyStates: HistoryState[] = [];
  const parentLinks = new Map<string, string>();

  // step 1: figure out state hierarchy

  const startTime = performance.now();

  for (const rt of concreteSyntax.rountangles) {
    const parent = uid2State.get(conns.insidenessMap.get(rt.uid)!)! as ConcreteState;
    const common = {
      kind: rt.kind,
      uid: rt.uid,
      comments: [],
      entryActions: [],
      exitActions: [],
      parent,
      depth: parent.depth + 1,
    };
    let state;
    if (rt.kind === "or") {
      state = {
        ...common,
        initial: [],
        children: [],
        history: [],
        timers: [],
      };
    }
    else if (rt.kind === "and") {
      state = {
        ...common,
        children: [],
        history: [],
        timers: [],
      };
    }
    parent.children.push(state as ConcreteState);
    parentLinks.set(rt.uid, parent.uid);
    uid2State.set(rt.uid, state as ConcreteState);
  }
  for (const d of concreteSyntax.diamonds) {
    const parent = uid2State.get(conns.insidenessMap.get(d.uid)!)! as ConcreteState;
    const pseudoState = {
      kind: "pseudo",
      uid: d.uid,
      comments: [],
      depth: parent.depth+1,
      parent,
      entryActions: [],
      exitActions: [],
    };
    uid2State.set(d.uid, pseudoState);
    parent.children.push(pseudoState);
  }
  for (const h of concreteSyntax.history) {
    const parent = uid2State.get(conns.insidenessMap.get(h.uid)!)! as ConcreteState;
    const historyState = {
      kind: h.kind,
      uid: h.uid,
      parent,
      depth: parent.depth+1,
    };
    parent.history.push(historyState);
    historyStates.push(historyState);
  }

  const endTime = performance.now();

  // currently seems to be quite fast:
  // console.log('built state tree', endTime-startTime);

  // step 2: figure out transitions

  const transitions = new Map<string, Transition[]>();
  const uid2Transition = new Map<string, Transition>();

  for (const arr of concreteSyntax.arrows) {
    const srcUID = conns.arrow2SideMap.get(arr.uid)?.[0]?.uid;
    const tgtUID = conns.arrow2SideMap.get(arr.uid)?.[1]?.uid;
    const historyTgtUID = conns.arrow2HistoryMap.get(arr.uid);
    if (!srcUID) {
      if (historyTgtUID) {
        errors.push({shapeUid: arr.uid, message: "no source"});
      }
      else if (!tgtUID) {
        // dangling edge
        errors.push({shapeUid: arr.uid, message: "dangling"});
      }
      else {
        // target but no source, so we treat is as an 'initial' marking
        const tgtState = uid2State.get(tgtUID)!;
        if (tgtState.kind === "pseudo") {
          // maybe allow this in the future?
          errors.push({
            shapeUid: arr.uid,
            message: "pseudo-state cannot be initial state",
          });
        }
        else {
          const ofState = uid2State.get(parentLinks.get(tgtUID)!)!;
          if (ofState.kind === "or") {
            ofState.initial.push([arr.uid, tgtState]);
          }
          else {
            // and states do not have an 'initial' state
            errors.push({
              shapeUid: arr.uid,
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
        const transition: Transition = {
          uid: arr.uid,
          src: uid2State.get(srcUID)!,
          tgt,
          label: [],
        }
        const existingTransitions = transitions.get(srcUID) || [];
        existingTransitions.push(transition);
        transitions.set(srcUID, existingTransitions);
        uid2Transition.set(arr.uid, transition);
      }
      else {
        errors.push({
          shapeUid: arr.uid,
          message: "no target",
        });
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

  const textsSorted = concreteSyntax.texts.toSorted((a,b) => a.topLeft.y - b.topLeft.y);
  for (const text of textsSorted) {
    let parsed: ParsedText;
    try {
      parsed = cachedParseLabel(text.text); // may throw
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
    const belongsToArrowUID = conns.text2ArrowMap.get(text.uid);
    const belongsToTransition = uid2Transition.get(belongsToArrowUID!);
    if (belongsToTransition) {
      const {src} = belongsToTransition;
      belongsToTransition.label.push(parsed);
      if (parsed.kind === "transitionLabel") {
        // collect events
        // triggers
        if (parsed.trigger.kind === "event") {
          if (src.kind === "pseudo") {
            errors.push({shapeUid: text.uid, message: "pseudo state outgoing transition must not have event trigger"});
          }
          else {
            const {event} = parsed.trigger;
            if (event.startsWith("_")) {
              errors.push(...addEvent(internalEvents, parsed.trigger, parsed.uid));
            }
            else {
              errors.push(...addEvent(inputEvents, parsed.trigger, parsed.uid));
            }
          }
        }
        else if (parsed.trigger.kind === "after") {
          if (src.kind === "pseudo") {
            errors.push({shapeUid: text.uid, message: "pseudo state outgoing transition must not have after-trigger"});
          }
          else {
            src.timers.push(parsed.trigger.durationMs);
            src.timers.sort();
          }
        }
        else if (["entry", "exit"].includes(parsed.trigger.kind)) {
          errors.push({shapeUid: text.uid, message: "entry/exit trigger not allowed on transitions"});
        }
        else if (parsed.trigger.kind === "triggerless") {
          if (src.kind !== "pseudo") {
            errors.push({shapeUid: text.uid, message: "triggerless transitions only allowed on pseudo-states"});
          }
        }
      }
    }
    else {
      // text does not belong to transition...
      // so it belongs to a rountangle (a state)
      const rountangleUID = conns.text2RountangleMap.get(text.uid);
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
            shapeUid: text.uid,
            message: "states can only have entry/exit triggers",
            data: {start: {offset: 0}, end: {offset: text.text.length}},
          });
        }
      }
      else if (parsed.kind === "comment") {
        // just append comments to their respective states
        if (!label2State.has(parsed.text)) {
          label2State.set(parsed.text, belongsToState);
        }
        belongsToState.comments.push([text.uid, parsed.text]);
      }
    }

    if (parsed.kind === "transitionLabel") {
      // collect output events
      for (const action of parsed.actions) {
        if (action.kind === "raise") {
          const {event} = action;
          if (event.startsWith("_")) {
            // internalEvents.add({event: event});
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

  // sort children by their label
  for (const state of uid2State.values()) {
    if (state.kind === "and") {
      state.children.sort((a, b) => stateDescription(a).localeCompare(stateDescription(b)));
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
    label2State,
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

function findVariablesAction(action: Action): Set<string> {
  if (action.kind === "assignment") {
    return new Set([action.lhs, ...findVariables(action.rhs)]);
  }
  return new Set();
}

