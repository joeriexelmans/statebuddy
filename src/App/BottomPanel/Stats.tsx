import { Statechart } from "@/statecharts/abstract_syntax"
import { useMemo } from "react"
import { getStats } from "@/statecharts/stats";

type StatsProps = {
  abstractSyntax: Statechart,
}

export function Stats({abstractSyntax}: StatsProps) {
  const stats = useMemo(() => getStats(abstractSyntax), [abstractSyntax]);

  return <>
    {stats.numAndStates} AND-states,&nbsp;
    {stats.numOrStates} OR-states,&nbsp;
    {stats.numPseudoStates} pseudo-states,&nbsp;
    {stats.numHistory} history states,&nbsp;
    {stats.numTransitions} transitions
  </>;
}