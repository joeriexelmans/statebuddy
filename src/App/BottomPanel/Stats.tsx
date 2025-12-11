import { Statechart } from "@/statecharts/abstract_syntax"
import { useMemo } from "react"
import { getStats } from "@/statecharts/stats";

type StatsProps = {
  ast: Statechart,
}

export function Stats({ast}: StatsProps) {
  const stats = useMemo(() => getStats(ast), [ast]);

  return <>
    {stats.numAndStates} AND-states,
    {stats.numOrStates} OR-states,
    {stats.numPseudoStates} pseudo-states,
    {stats.numHistory} history states,
    {stats.numTransitions} transitions
  </>;
}