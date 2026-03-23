import { useState } from "react";

type State<T> = {
  kind: "pending",
} | {
  kind: "resolved",
  result: T,
} | {
  kind: "rejected",
  err: any,
}

export function usePromise<T>() {
  const [state, setState] = useState<State<T>>({kind: "pending"});

  const setPromise = (promise: Promise<T>) => {
    setState({kind: "pending"});
    let canceled = false;
    promise.then(result => {
      if (!canceled) {
        setState({kind: "resolved", result});
      }
    })
    .catch(err => setState({kind: "rejected", err}));
    
    return () => { canceled = true; };
  };

  return [state, setPromise] as const;
}
