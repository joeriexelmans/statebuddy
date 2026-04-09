import {  ConcreteState, HistoryState, OrState, UnstableState, Statechart, stateDescription, Transition, computeArena } from "./abstract_syntax";
import { Action, EventTrigger, Expression, Lhs, ParsedText } from "./label_ast";
import { parse as parseLabel, SyntaxError } from "./label_parser";
import { Topology } from "./detect_topology";
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
  //   if (haveEvent.param !== e.param === undefined) {
  //     return [{
  //         shapeUid: textUid,
  //         message: "inconsistent event parameter",
  //     }];
  //   }
    return [];
  }
  else {
    events.push(e);
    events.sort((a,b) => a.event.localeCompare(b.event));
    return [];
  }
}

export function parseStatechart(topology: Topology): [Statechart, TraceableError[]] {
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

  for (const [uid, kind] of topology.rountangles.entries()) {
    const parent = uid2State.get(topology.insidenessMap.get(uid)!)! as ConcreteState;
    const common = {
      kind,
      uid,
      comments: [],
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
        errors.push({shapeUid: uid, message: "no source"});
      }
      else if (!tgtUID) {
        // dangling edge
        errors.push({shapeUid: uid, message: "dangling"});
      }
      else {
        // target but no source, so we treat is as an 'initial' marking
        const tgtState = uid2State.get(tgtUID)!;
        if (tgtState.kind === "pseudo") {
          // maybe allow this in the future?
          errors.push({
            shapeUid: uid,
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
              shapeUid: uid,
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
          shapeUid: uid,
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
          message: "needs initial state",
        });
      }
    }
  }

  let variables = new Set<string>();
  const inputEvents: EventTrigger[] = [];

  // internal events that occur somewhere as an event trigger
  const internalEventTrigger: EventTrigger[] = [];
  // internal events that are raised somewhere
  const internalEventRaised: EventTrigger[] = [];
  // union of the above two.
  const internalEvents: EventTrigger[] = [];

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
          shapeUid: uid,
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
            errors.push({shapeUid: uid, message: "cannot have trigger"});
          }
          else {
            const {event} = parsed.trigger;
            if (event.startsWith("_")) {
              errors.push(...addEvent(internalEventTrigger, parsed.trigger, parsed.uid));
              errors.push(...addEvent(internalEvents, parsed.trigger, parsed.uid));
            }
            else {
              errors.push(...addEvent(inputEvents, parsed.trigger, parsed.uid));
            }
          }
        }
        else if (parsed.trigger.kind === "after") {
          if (src.kind === "pseudo") {
            errors.push({shapeUid: uid, message: "cannot have trigger"});
          }
          else {
            src.timers.push(parsed.trigger.durationMs);
            src.timers.sort();
          }
        }
        else if (["entry", "exit"].includes(parsed.trigger.kind)) {
          errors.push({shapeUid: uid, message: "entry/exit trigger not allowed on transitions"});
        }
        else if (parsed.trigger.kind === "triggerless") {
          if (src.kind !== "pseudo") {
            errors.push({shapeUid: uid, message: "needs trigger"});
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
            shapeUid: uid,
            message: "must belong to transition",
            data: {start: {offset: 0}, end: {offset: text.length}},
          });
        }
      }
      else if (parsed.kind === "comment") {
        // just append comments to their respective states
        if (!label2State.has(parsed.text)) {
          label2State.set(parsed.text, belongsToState);
        }
        belongsToState.comments.push([uid, parsed.text]);
      }
    }

    if (parsed.kind === "transitionLabel") {
      // collect output events
      for (const action of parsed.actions) {
        if (action.kind === "raise") {
          const {event} = action;
          if (event.startsWith("_")) {
            const e = {kind: "event", event: event} as EventTrigger;
            errors.push(...addEvent(internalEventRaised, e, parsed.uid));
            errors.push(...addEvent(internalEvents, e, parsed.uid));
            // internalEventRaised.push(e);
            // internalEvents.push(e);
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
    internalEventTrigger,
    internalEventRaised,
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
