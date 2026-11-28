import { AbstractSyntax } from "@/languages/statecharts/abstract_syntax"
import { useMemo } from "react"
import { getStats } from "@/languages/statecharts/stats";

type StatsProps = {
  abstractSyntax: AbstractSyntax,
}

export function Stats({abstractSyntax}: StatsProps) {
  const stats = useMemo(() => getStats(abstractSyntax), [abstractSyntax]);

  return <>
    {stats.numAndStates} AND,&nbsp;
    {stats.numOrStates} OR,&nbsp;
    {stats.numPseudoStates} pseudo,&nbsp;
    {stats.numHistory} history,&nbsp;
    {stats.numTransitions} transitions
  </>;
}