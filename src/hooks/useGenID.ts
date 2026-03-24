import { useCallback, useRef } from "react";

// generates (locally) unique IDs
export function useGenID() {
  const state = useRef({numInUse: 0, nextID: 0});

  const next = useCallback(() => {
    const id = (state.current.nextID++).toString();
    state.current.numInUse++;
    return id;
  }, []);

  const release = useCallback(() => {
    const inUse = --state.current.numInUse;
    if ((inUse) === 0) {
      // we can safely reset our state if the number of in-use IDs becomes zero
      state.current.nextID = 0;
    }
  }, []);

  return [next, release] as const;
}
