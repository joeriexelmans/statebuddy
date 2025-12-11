import { Statechart, TransitionSrcTgt } from "./abstract_syntax";

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

export function getStats(ast: Statechart) {
  const [numAndStates, numOrStates, numPseudoStates] = countStates(ast.root);
  return {
    numAndStates,
    numOrStates,
    numPseudoStates,
    numHistory: ast.historyStates.length,
    numTransitions: [...ast.transitions.values()].length,
  };
}