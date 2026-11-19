import { useCallback, useRef } from "react";

// generates (locally) unique IDs
export function useGenID() {
  const ref = useRef({numInUse: 0, nextID: 0});

  const next = useCallback(() => {
    const id = (ref.current.nextID++).toString();
    ref.current.numInUse++;
    return id;
  }, []);

  const release = useCallback(() => {
    const inUse = --ref.current.numInUse;
    if ((inUse) === 0) {
      // we can safely reset our state if the number of in-use IDs becomes zero
      ref.current.nextID = 0;
    }
  }, []);

  return [next, release] as const;
}
