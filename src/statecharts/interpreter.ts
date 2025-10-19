import { computeArena2, computePath, ConcreteState, getDescendants, HistoryState, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition, transitionDescription } from "./abstract_syntax";
import { evalExpr } from "./actionlang_interpreter";
import { Action, EventTrigger, TransitionLabel } from "./label_ast";
import { BigStepOutput, Environment, initialRaised, Mode, RaisedEvents, RT_Event, RT_History, RT_Statechart, TimerElapseEvent, Timers } from "./runtime_types";

export function initialize(ast: Statechart): BigStepOutput {
  let history = new Map();
  let enteredStates, environment, raised;
  ({enteredStates, environment, history, ...raised} = enterDefault(0, ast.root, {
    environment: new Environment([new Map([["_timers", []]])]),
    history,
    ...initialRaised,
  }));
  return handleInternalEvents(0, ast, {mode: enteredStates, environment, history,  ...raised});
}

type ActionScope = {
  environment: Environment,
  history: RT_History,
} & RaisedEvents;

type EnteredScope = { enteredStates: Mode } & ActionScope;

export function execAction(action: Action, rt: ActionScope): ActionScope {
  if (action.kind === "assignment") {
    const rhs = evalExpr(action.rhs, rt.environment);
    const environment = rt.environment.set(action.lhs, rhs);
    return {
      ...rt,
      environment,
    };
  }
  else if (action.kind === "raise") {
    const raisedEvent = {
      name: action.event,
      param: action.param && evalExpr(action.param, rt.environment),
    };
    if (action.event.startsWith('_')) {
      // append to internal events
      return {
        ...rt,
        internalEvents: [...rt.internalEvents, raisedEvent],
      };
    }
    else {
      // append to output events
      return {
        ...rt,
        outputEvents: [...rt.outputEvents, raisedEvent],
      }
    }
  }
  throw new Error("should never reach here");
}

export function entryActions(simtime: number, state: ConcreteState, actionScope: ActionScope): ActionScope {
  // console.log('enter', stateDescription(state), '...');
  let {environment, ...rest} = actionScope;
  // environment = environment.pushScope();
  for (const action of state.entryActions) {
    ({environment, ...rest} = execAction(action, {environment, ...rest}));
  }
  // schedule timers
  // we store timers in the environment (dirty!)
  environment = environment.transform<Timers>("_timers", oldTimers => {
    const newTimers = [
      ...oldTimers,
      ...state.timers.map(timeOffset => {
        const futureSimTime = simtime + timeOffset;
        return [futureSimTime, {kind: "timer", state: state.uid, timeDurMs: timeOffset}] as [number, TimerElapseEvent];
      }),
    ];
    newTimers.sort((a,b) => a[0] - b[0]);
    return newTimers;
  }, []);
  // new nested scope
  return {environment, ...rest};
}

export function exitActions(simtime: number, state: ConcreteState, {enteredStates, ...actionScope}: EnteredScope): ActionScope {
  // console.log('exit', stateDescription(state), '...');
  for (const action of state.exitActions) {
    (actionScope = execAction(action, actionScope));
  }
  let environment = actionScope.environment;
  // cancel timers
  environment = environment.transform<Timers>("_timers", oldTimers => {
    // remove all timers of 'state':
    return oldTimers.filter(([_, {state: s}]) => s !== state.uid);
  }, []);
  // environment = environment.popScope();
  return {...actionScope, environment};
}

// recursively enter the given state's default state
export function enterDefault(simtime: number, state: ConcreteState, rt: ActionScope): EnteredScope {
  let {firedTransitions, ...actionScope} = rt;

  // execute entry actions
  ({firedTransitions, ...actionScope} = entryActions(simtime, state, {firedTransitions, ...actionScope}));

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, firedTransitions, ...actionScope} = enterDefault(simtime, child, {firedTransitions, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // same as AND-state, but we only enter the initial state(s)
    if (state.initial.length > 0) {
      if (state.initial.length > 1) {
        console.warn(state.uid + ': multiple initial states, only entering one of them');
      }
      const [arrowUid, toEnter] = state.initial[0];
      firedTransitions = [...firedTransitions, arrowUid];
      let enteredChildren;
      ({enteredStates: enteredChildren, firedTransitions, ...actionScope} = enterDefault(simtime, toEnter, {firedTransitions, ...actionScope}));
      enteredStates = enteredStates.union(enteredChildren);
    }
    // console.warn(state.uid + ': no initial state');
  }

  return {enteredStates, firedTransitions, ...actionScope};
}

// recursively enter the given state and, if children need to be entered, preferrably those occurring in 'toEnter' will be entered. If no child occurs in 'toEnter', the default child will be entered.
export function enterStates(simtime: number, state: ConcreteState, toEnter: Set<string>, actionScope: ActionScope): EnteredScope {

  // execute entry actions
  actionScope = entryActions(simtime, state, actionScope);

  // enter children...
  let enteredStates = new Set([state.uid]);

  if (state.kind === "and") {
    // every child must be entered
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterStates(simtime, child, toEnter, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // only one child can be entered
    const childToEnter = state.children.filter(child => toEnter.has(child.uid));
    if (childToEnter.length === 1) {
      // good
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterStates(simtime, childToEnter[0], toEnter, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else if (childToEnter.length === 0) {
      // also good, enter default child
      for (const [_, defaultChild] of state.initial) {
        let enteredChildren;
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, defaultChild, actionScope));
        enteredStates = enteredStates.union(enteredChildren);
        break; // one is enough
      }
    }
    else {
      throw new Error("can only enter one child of an OR-state, stupid!");
    }
  }

  return { enteredStates, ...actionScope };
}

// exit the given state and all its active descendants
export function exitCurrent(simtime: number, state: ConcreteState, rt: EnteredScope): ActionScope {
  let {enteredStates, history, ...actionScope} = rt;

  if (enteredStates.has(state.uid)) {
    // exit all active children...
    for (const child of state.children) {
      ({history, ...actionScope} = exitCurrent(simtime, child,  {enteredStates, history, ...actionScope}));
    }

    // execute exit actions
    ({history, ...actionScope} = exitActions(simtime, state, {enteredStates, history, ...actionScope}));

    // record history
    for (const h of state.history) {
      if (h.kind === "shallow") {
        history.set(h.uid, new Set(state.children
          .filter(child => enteredStates.has(child.uid))
          .map(child => child.uid)));
      }
      else if (h.kind === "deep") {
        // horribly inefficient (i don't care)
        history.set(h.uid,
          getDescendants(state)
          .difference(new Set([state.uid]))
          .intersection(enteredStates)
        );
      }
    }
  }

  return {history, ...actionScope};
}

export function handleEvent(simtime: number, event: RT_Event, statechart: Statechart, activeParent: StableState, {environment, mode, history, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  const arenasFired = new Set<OrState>();
  for (const state of activeParent.children) {
    if (mode.has(state.uid)) {
      const outgoing = statechart.transitions.get(state.uid) || [];
      const labels = outgoing.flatMap(t =>
        t.label
          .filter(l => l.kind === "transitionLabel")
          .map(l => [t,l] as [Transition, TransitionLabel]));
      let triggered;
      if (event.kind === "input") {
        // get transitions triggered by event
        triggered = labels.filter(([_t,l]) =>
          l.trigger.kind === "event" && l.trigger.event === event.name);
      }
      else {
        // get transitions triggered by timeout
        triggered = labels.filter(([_t,l]) =>
          l.trigger.kind === "after" && l.trigger.durationMs === event.timeDurMs);
      }
      // eval guard
      const guardEnvironment = environment.set("inState", (stateLabel: string) => {
        for (const [uid, state] of statechart.uid2State.entries()) {
          if (stateDescription(state) === stateLabel) {
            return (mode.has(uid));
          }
        }
      });
      const enabled = triggered.filter(([t,l]) =>
        evalExpr(l.guard, guardEnvironment));
      if (enabled.length > 0) {
        if (enabled.length > 1) {
          console.warn('nondeterminism!!!!');
        }
        const [t,l] = enabled[0]; // just pick one transition
        const arena = computeArena2(t, statechart.transitions);
        let overlapping = false;
        for (const alreadyFired of arenasFired) {
          if (isOverlapping(arena, alreadyFired)) {
            overlapping = true;
          }
        }
        if (!overlapping) {
          if (event.kind === "input" && event.param !== undefined) {
            // input events may have a parameter
            // add event parameter to environment in new scope
            environment = environment.pushScope();
            environment = environment.newVar(
              (l.trigger as EventTrigger).paramName as string,
              event.param,
            );
          }
          ({mode, environment, history, ...raised} = fireTransition(simtime, t, statechart.transitions, l, arena, {mode, environment, history, ...raised}));
          if (event.kind === "input" && event.param !== undefined) {
            environment = environment.popScope();
          }
          arenasFired.add(arena);
        }
        else {
          // console.log('skip (overlapping arenas)');
        }
      }
      else {
        // no enabled outgoing transitions, try the children:
        ({environment, mode, history, ...raised} = handleEvent(simtime, event, statechart, state, {environment, mode, history, ...raised}));
      }
    }
  }
  return {environment, mode, history, ...raised};
}

export function handleInputEvent(simtime: number, event: RT_Event, statechart: Statechart, {mode, environment, history}: {mode: Mode, environment: Environment, history: RT_History}): BigStepOutput {
  let raised = initialRaised;

  ({mode, environment, ...raised} = handleEvent(simtime, event, statechart, statechart.root, {mode, environment, history, ...raised}));

  return handleInternalEvents(simtime, statechart, {mode, environment, history, ...raised});
}

export function handleInternalEvents(simtime: number, statechart: Statechart, {internalEvents, ...rest}: RT_Statechart & RaisedEvents): BigStepOutput {
  while (internalEvents.length > 0) {
    const [nextEvent, ...remainingEvents] = internalEvents;
    ({internalEvents, ...rest} = handleEvent(simtime, 
      {kind: "input", ...nextEvent}, // internal event becomes input event
      statechart, statechart.root, {internalEvents: remainingEvents, ...rest}));
  }
  return rest;
}

export function fireTransition(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, history, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  console.log('fire', transitionDescription(t));

  const srcPath = computePath({ancestor: arena, descendant: t.src as ConcreteState}).reverse() as ConcreteState[];

  // exit src and other states up to arena
  ({environment, history, ...raised} = exitCurrent(simtime, srcPath[0], {environment, enteredStates: mode, history, ...raised}))
  const toExit = getDescendants(arena);
  toExit.delete(arena.uid); // do not exit the arena itself
  const exitedMode = mode.difference(toExit); // active states after exiting the states we need to exit

  // console.log({exitedMode});

  return fireSecondHalfOfTransition(simtime, t, ts, label, arena, {mode: exitedMode, history, environment, ...raised});
}

// assuming we've already exited the source state of the transition, now enter the target state
// IF however, the target is a pseudo-state, DON'T enter it (pseudo-states are NOT states), instead fire the first pseudo-outgoing transition.
export function fireSecondHalfOfTransition(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, history, firedTransitions, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  // exec transition actions
  for (const action of label.actions) {
    ({environment, history, firedTransitions, ...raised} = execAction(action, {environment, history, firedTransitions, ...raised}));
  }

  firedTransitions = [...firedTransitions, t.uid];

  if (t.tgt.kind === "pseudo") {
    const outgoing = ts.get(t.tgt.uid) || [];
    for (const nextT of outgoing) {
      for (const nextLabel of nextT.label) {
        if (nextLabel.kind === "transitionLabel") {
          if (evalExpr(nextLabel.guard, environment)) {
            console.log('fire', transitionDescription(nextT));
            // found ourselves an enabled transition
            return fireSecondHalfOfTransition(simtime, nextT, ts, nextLabel, arena, {mode, environment, history, firedTransitions, ...raised});
          }
        }
      }
    }
    throw new Error("stuck in pseudo-state!!");
  }
  else {
    const tgtPath = computePath({ancestor: arena, descendant: t.tgt});
    const state = tgtPath[0] as ConcreteState;
    let toEnter;
    if (t.tgt.kind === "deep" || t.tgt.kind === "shallow") {
      toEnter = new Set([
        ...tgtPath.slice(0,-1).map(s => s.uid),
        ...history.get(t.tgt.uid)!
      ]) as Set<string>;
    }
    else {
      toEnter = new Set(tgtPath.map(s=>s.uid));
    }
    
    // enter tgt
    let enteredStates;
    ({enteredStates, environment, history, ...raised} = enterStates(simtime, state, toEnter, {environment, history, firedTransitions, ...raised}));
    const enteredMode = mode.union(enteredStates);

    // console.log({enteredMode});

    return {mode: enteredMode, environment, history, firedTransitions, ...raised};
  }
}
