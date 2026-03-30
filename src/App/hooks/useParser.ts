import { useMemo } from "react";
import { computeTopology, topologiesEqual } from "@/statecharts/detect_topology";
import { parseStatechart } from "@/statecharts/parser";
import { useCustomMemo } from "@/hooks/useCustomMemo";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { EventTrigger } from "@/statecharts/label_ast";

export function useParser(
  editorState: VisualEditorState,
  declaredInputs: EventTrigger[],
  declaredOutputs: EventTrigger[],
) {
  // Re-compute the topology whenever there is any change to the concrete syntax.
  // This is quite fast because it's quite optimized and internally shit is memoized as well.
  const topology = useMemo(() => computeTopology(editorState), [editorState]);

  // Custom memo to only call the parser after either the topology changes, or when there is a sufficient change to the concrete syntax (e.g., an AND-state becoming an OR-state).
  // This stage of parsing is fast (so no problem here), but we don't want to trigger a re-render of everything that depends on the abstract syntax, because that is A LOT and it is SLOW.
  const [abstractSyntax, syntaxErrors] = useCustomMemo(
    () => {
      const [abstractSyntax, syntaxErrors] = parseStatechart(topology);

      // explicitly declared in/out events are added to the abstract syntax's list of in/out events
      for (const declaredInput of declaredInputs) {
        if (!abstractSyntax.inputEvents.some(({event}) => event === declaredInput.event)) {
          abstractSyntax.inputEvents.push(declaredInput);
        }
      }
      abstractSyntax.outputEvents = abstractSyntax.outputEvents.union(new Set(declaredOutputs.map(out => out.event)));
      return [abstractSyntax, syntaxErrors] as const;
    },

    // dependencies:
    [topology, declaredInputs, declaredOutputs] as const,

    // custom compare fn:
    ([prevTopo, prevDeclaredInputs, prevDeclaredOutputs], [nextTopo, nextDeclaredInputs, nextDeclaredOutputs]) => {
      if (prevDeclaredInputs !== nextDeclaredInputs) return false;
      if (prevDeclaredOutputs !== nextDeclaredOutputs) return false;
      return topologiesEqual(prevTopo, nextTopo);
  });

  return useMemo(() => ({
    topology,
    abstractSyntax,
    syntaxErrors,
  }), [topology, abstractSyntax, syntaxErrors]);
}
