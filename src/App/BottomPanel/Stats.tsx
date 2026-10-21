import { AbstractSyntax } from "@/languages/statecharts/abstract_syntax"
import { useMemo } from "react"
import { getStats } from "@/languages/statecharts/stats";

type StatsProps = {
  abstractSyntax: AbstractSyntax,
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