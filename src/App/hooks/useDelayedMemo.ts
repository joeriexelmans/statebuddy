import { useState } from "react";
import { useDelayedEffect } from "../../hooks/useDelayedEffect";

// like useDelay, but it computes a value
// This should never be used blindly as an alternative to useMemo!! It must be safe to see a stale value for a short period of time after the deps change.
export function useDelayedMemo<T>(factory: () => T, deps: any[], delayMs: number) {
  const [state, setState] = useState(factory);
  useDelayedEffect(() => {
    const newState = factory();
    setState(newState);
  }, delayMs, deps);
  return state;
}
