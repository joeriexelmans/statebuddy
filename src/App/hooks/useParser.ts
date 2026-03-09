import { useMemo } from "react";
import { computeTopology, reducedConcreteSyntaxEqual, topologiesEqual } from "@/statecharts/detect_topology";
import { parseStatechart } from "@/statecharts/parser";
import { useCustomMemo } from "@/hooks/useCustomMemo";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";

export function useParser(editorState?: VisualEditorState) {
  // Re-compute the topology whenever there is any change to the concrete syntax.
  // This is quite fast because it's quite optimized and internally shit is memoized as well.
  const topology = useMemo(() => editorState && computeTopology(editorState), [editorState]);

  // Custom memo to only call the parser after either the topology changes, or when there is a sufficient change to the concrete syntax (e.g., an AND-state becoming an OR-state).
  // This stage of parsing is fast (so no problem here), but we don't want to trigger a re-render of everything that depends on the abstract syntax, because that is A LOT and it is SLOW.
  const parsed = useCustomMemo(
    () => editorState && topology && parseStatechart(editorState, topology),
    // dependencies:
    [editorState, topology] as const,
    // custom compare fn:
    ([prevState, prevTopo], [nextState, nextTopo]) => {
      if (prevTopo === undefined) {
        return nextTopo === undefined;
      }
      if (prevState === undefined) {
        return nextState === undefined;
      }
      if (nextTopo === undefined) return false;
      if (nextState === undefined) return false;
      return topologiesEqual(prevTopo, nextTopo)
        && reducedConcreteSyntaxEqual(prevState, nextState);
  });

  return useMemo(() => ({
    topology,
    abstractSyntax: parsed && parsed[0],
    syntaxErrors: parsed && parsed[1] || [],
  }), [topology, parsed]);
}
