import { Statechart } from "@/statecharts/abstract_syntax"
import { useMemo } from "react"
import { getStats } from "@/statecharts/stats";

type StatsProps = {
  abstractSyntax: Statechart,
}

export function Stats({abstractSyntax}: StatsProps) {
  const stats = useMemo(() => getStats(abstractSyntax), [abstractSyntax]);

  return <>
    {stats.numAndStates} AND-states,
    {stats.numOrStates} OR-states,
    {stats.numPseudoStates} pseudo-states,
    {stats.numHistory} history states,
    {stats.numTransitions} transitions
  </>;
}