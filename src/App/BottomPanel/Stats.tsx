import { ConcreteState, Statechart, TransitionSrcTgt } from "@/statecharts/abstract_syntax"
import { useMemo } from "react"
import { Tooltip } from "../Components/Tooltip";

type StatsProps = {
  ast: Statechart,
}

function countStates(root: TransitionSrcTgt) {
  let and = 0, or = 0, pseudo = 0;
  if (root.kind === "and") {
    and++;
  }
  else if (root.kind === "or") {
    or++;
  }
  else {
    return [and, or, pseudo];
  }
  for (const child of root.children) {
    let [and2, or2, pseudo2] = countStates(child);
    and += and2;
    or += or2;
    pseudo += pseudo2;
  }
  return [and, or, pseudo];
}

export function Stats({ast}: StatsProps) {
  const numHistory = ast.historyStates.length;
  const [numAndStates, numOrStates, numPseudoStates] = useMemo(() => {
    return countStates(ast.root);
  }, [ast.root])
  const numTransitions = useMemo(() => {
    let n = 0;
    for (const ts of ast.transitions.values()) {
      n += ts.length;
    }
    return n;
  }, [ast.transitions]);

  return <>
  {/* <Tooltip above tooltip={`${numAndStates} AND-states
${numOrStates} OR-states
${numPseudoStates} pseudo-states
${numHistory} history states`}> */}
  {/* {numAndStates+numOrStates+numPseudoStates+numHistory} states */}
  {numAndStates} AND-states, {numOrStates} OR-states, {numPseudoStates} pseudo-states, {numHistory} history states
  {/* </Tooltip> */}
  , {numTransitions} transitions</>
}