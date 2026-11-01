import { useRef } from "react";

// Incremental memoization function that computes an output based on an input. The function also has access to the previous input and the previous output, which it can use to (optionally) compute the new output more efficiently.
export function useIncrementalMemo<I, O>(compute: (oldInput: I | null, newInput: I, oldOutput: O | null) => O, newInput: I) {
  const oldInput = useRef<I>(null);
  const oldOutput = useRef<O>(null);
  const newOutput = compute(oldInput.current, newInput, oldOutput.current);

  oldInput.current = newInput;
  oldOutput.current = newOutput;
  return newOutput;
}