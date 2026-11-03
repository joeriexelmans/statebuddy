import { useRef } from "react";

// Incremental memoization function that computes an output based on an input. The function also has access to the previous input and the previous output, which it can use to (optionally) compute the new output more efficiently.
export function useIncrementalMemo<I, O>(compute: (oldInput: I, newInput: I, oldOutput: O) => O, initial: (input: I) => O, newInput: I) {
  const oldComputation = useRef<{input: I, output: O}>(undefined);
  let newOutput;
  if (oldComputation.current === undefined) {
    newOutput = initial(newInput);
  }
  else {
    newOutput = compute(oldComputation.current.input, newInput, oldComputation.current.output);
  };
  oldComputation.current = {input: newInput, output: newOutput};
  return newOutput;
}
