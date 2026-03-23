import { useState } from "react";

type State<T> = {
  kind: "pending",
  cancel: () => void,
} | {
  kind: "resolved",
  result: T,
} | {
  kind: "rejected",
  err: any,
}

// Often we want to render the result of an asynchronous (long running) computation.
// But the input values for the computation may also change, in which case we want to ignore the result of the ongoing computation that was using the old values when it resolves.
// This hook does precisely that.
export function usePromise<T>() {
  const [state, setState] = useState<State<T>>({kind: "pending", cancel: () => {}});

  const setPromise = (promise: Promise<T>) => {
    let tooLate = false;
    const cancel = () => { tooLate = true; };
    setState(prevState => {
      if (prevState.kind === "pending") {
        // in case the user forgets...
        prevState.cancel();
      }
      return {kind: "pending", cancel}
    });
    promise.then(result => {
      if (!tooLate) {
        setState({kind: "resolved", result});
      }
    })
    .catch(err => setState({kind: "rejected", err}));

    return cancel;
  };

  return [state, setPromise] as const;
}
