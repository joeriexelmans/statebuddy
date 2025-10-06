import { ConcreteState, Statechart } from "./ast";

export function initialize(ast: Statechart): RT_Statechart {
  const rt_root = recursiveEnter(ast.root) as RT_OrState;
  return {
    root: rt_root,
    variables: new Map(),
  };
}

export function recursiveEnter(state: ConcreteState): RT_ConcreteState {
  if (state.kind === "and") {
    return {
      kind: "and",
      children: state.children.map(child => recursiveEnter(child)),
    };
  }
  else {
    const currentState = state.initial[0][1];
    return {
      kind: "or",
      current: currentState.uid,
      current_rt: recursiveEnter(currentState),
    };
  }
}