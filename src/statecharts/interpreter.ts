import { computeArena2, computePath, ConcreteState, getDescendants, isOverlapping, OrState, StableState, Statechart, stateDescription, Transition } from "./abstract_syntax";
import { evalExpr } from "./actionlang_interpreter";
import { Action, EventTrigger, TransitionLabel } from "./label_ast";
import { BigStepOutput, Environment, initialRaised, Mode, RaisedEvents, RT_Event, RT_Statechart, TimerElapseEvent, Timers } from "./runtime_types";

export function initialize(ast: Statechart): BigStepOutput {
  let {enteredStates, environment, ...raised} = enterDefault(0, ast.root, {
    environment: new Environment([new Map([["_timers", []]])]),
    ...initialRaised,
  });
  return handleInternalEvents(0, ast, {mode: enteredStates, environment, ...raised});
}

type ActionScope = {
  environment: Environment,
} & RaisedEvents;

type EnteredScope = { enteredStates: Mode } & ActionScope;

export function entryActions(simtime: number, state: ConcreteState, actionScope: ActionScope): ActionScope {
  // console.log('enter', stateDescription(state), '...');
  let {environment, ...rest} = actionScope;
  environment = environment.pushScope();
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

export function exitActions(simtime: number, state: ConcreteState, actionScope: ActionScope): ActionScope {
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
  environment = environment.popScope();
  return {...actionScope, environment};
}

export function enterDefault(simtime: number, state: ConcreteState, rt: ActionScope): EnteredScope {
  let actionScope = rt;

  // execute entry actions
  actionScope = entryActions(simtime, state, actionScope);

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    // same as AND-state, but we only enter the initial state(s)
    if (state.initial.length > 0) {
      if (state.initial.length > 1) {
        console.warn(state.uid + ': multiple initial states, only entering one of them');
      }
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, state.initial[0][1], actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    console.warn(state.uid + ': no initial state');
  }

  return {enteredStates, ...actionScope};
}

export function enterPath(simtime: number, path: ConcreteState[], rt: ActionScope): EnteredScope {
  let actionScope = rt;

  const [state, ...rest] = path;

  // execute entry actions
  actionScope = entryActions(simtime, state, actionScope);

  // enter children...
  let enteredStates = new Set([state.uid]);
  if (state.kind === "and") {
    // enter every child
    for (const child of state.children) {
      let enteredChildren;
      if (rest.length > 0 && child.uid === rest[0].uid) {
        ({enteredStates: enteredChildren, ...actionScope} = enterPath(simtime, rest, actionScope));
      }
      else {
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
      }
      enteredStates = enteredStates.union(enteredChildren);
    }
  }
  else if (state.kind === "or") {
    if (rest.length > 0) {
      let enteredChildren;
      ({enteredStates: enteredChildren, ...actionScope} = enterPath(simtime, rest, actionScope));
      enteredStates = enteredStates.union(enteredChildren);
    }
    else {
      // same as AND-state, but we only enter the initial state(s)
      for (const [_, child] of state.initial) {
        let enteredChildren;
        ({enteredStates: enteredChildren, ...actionScope} = enterDefault(simtime, child, actionScope));
        enteredStates = enteredStates.union(enteredChildren);
      }
    }
  }

  return { enteredStates, ...actionScope };
}

// exit the given state and all its active descendants
export function exitCurrent(simtime: number, state: ConcreteState, rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  if (enteredStates.has(state.uid)) {
    // exit all active children...
    for (const child of state.children) {
      actionScope = exitCurrent(simtime, child,  {enteredStates, ...actionScope});
    }

    // execute exit actions
    actionScope = exitActions(simtime, state, actionScope);
  }

  return actionScope;
}

export function exitPath(simtime: number, path: ConcreteState[], rt: EnteredScope): ActionScope {
  let {enteredStates, ...actionScope} = rt;

  const toExit = enteredStates.difference(new Set(path.map(s=>s.uid)));

  const [state, ...rest] = path;
  
  // exit state and all its children, *except* states along the rest of the path
  actionScope = exitCurrent(simtime, state,  {enteredStates: toExit, ...actionScope});
  if (rest.length > 0) {
    actionScope = exitPath(simtime, rest, {enteredStates, ...actionScope});
  }

  // execute exit actions
  actionScope = exitActions(simtime, state, actionScope);
  return actionScope;
}

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

export function handleEvent(simtime: number, event: RT_Event, statechart: Statechart, activeParent: StableState, {environment, mode, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
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
          ({mode, environment, ...raised} = fireTransition2(simtime, t, statechart.transitions, l, arena, {mode, environment, ...raised}));
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
        ({environment, mode, ...raised} = handleEvent(simtime, event, statechart, state, {environment, mode, ...raised}));
      }
    }
  }
  return {environment, mode, ...raised};
}

export function handleInputEvent(simtime: number, event: RT_Event, statechart: Statechart, {mode, environment}: {mode: Mode, environment: Environment}): BigStepOutput {
  let raised = initialRaised;

  ({mode, environment, ...raised} = handleEvent(simtime, event, statechart, statechart.root, {mode, environment, ...raised}));

  return handleInternalEvents(simtime, statechart, {mode, environment, ...raised});
}

export function handleInternalEvents(simtime: number, statechart: Statechart, {mode, environment, ...raised}: RT_Statechart & RaisedEvents): BigStepOutput {
  while (raised.internalEvents.length > 0) {
    const [internalEvent, ...rest] = raised.internalEvents;
    ({mode, environment, ...raised} = handleEvent(simtime, 
      {kind: "input", ...internalEvent}, // internal event becomes input event
      statechart, statechart.root, {mode, environment, internalEvents: rest, outputEvents: raised.outputEvents}));
  }
  return {mode, environment, outputEvents: raised.outputEvents};
}

function transitionDescription(t: Transition) {
  return stateDescription(t.src) + ' ➔ ' + stateDescription(t.tgt);
}

export function fireTransition2(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  console.log('fire', transitionDescription(t));

  const srcPath = computePath({ancestor: arena, descendant: t.src as ConcreteState}).reverse();

  // exit src and other states up to arena
  ({environment, ...raised} = exitPath(simtime, srcPath, {environment, enteredStates: mode, ...raised}));
  const toExit = getDescendants(arena);
  toExit.delete(arena.uid); // do not exit the arena itself
  const exitedMode = mode.difference(toExit); // active states after exiting the states we need to exit

  // console.log({exitedMode});

  return fireSecondHalfOfTransition(simtime, t, ts, label, arena, {mode: exitedMode, environment, ...raised});
}

// assuming we've already exited the source state of the transition, now enter the target state
// IF however, the target is a pseudo-state, DON'T enter it (pseudo-states are NOT states), instead fire the first pseudo-outgoing transition.
export function fireSecondHalfOfTransition(simtime: number, t: Transition, ts: Map<string, Transition[]>, label: TransitionLabel, arena: OrState, {mode, environment, ...raised}: RT_Statechart & RaisedEvents): RT_Statechart & RaisedEvents {
  // exec transition actions
  for (const action of label.actions) {
    ({environment, ...raised} = execAction(action, {environment, ...raised}));
  }

  if (t.tgt.kind === "pseudo") {
    const outgoing = ts.get(t.tgt.uid) || [];
    for (const nextT of outgoing) {
      for (const nextLabel of nextT.label) {
        if (nextLabel.kind === "transitionLabel") {
          if (evalExpr(nextLabel.guard, environment)) {
            console.log('fire', transitionDescription(nextT));
            // found ourselves an enabled transition
            return fireSecondHalfOfTransition(simtime, nextT, ts, nextLabel, arena, {mode, environment, ...raised});
          }
        }
      }
    }
    throw new Error("stuck in pseudo-state!!")
  }
  else {
    const tgtPath = computePath({ancestor: arena, descendant: t.tgt});
    // enter tgt
    let enteredStates;
    ({enteredStates, environment, ...raised} = enterPath(simtime, tgtPath, {environment, ...raised}));
    const enteredMode = mode.union(enteredStates);

    // console.log({enteredMode});

    return {mode: enteredMode, environment, ...raised};
  }
}
