import { useEffect } from "react";

// Like useEffect, but with a delay.
export function useDelayedEffect(
  doSomething: () => (void | (() => void)),
  delayMs: number,
  deps: any[],
) {
  useEffect(() => {
    let cancel: (void | (() => void));
    const timeout = setTimeout(() => {
      cancel = doSomething();
    }, delayMs);
    return () => {
      if (typeof cancel === 'function') {
        // the delayed thing started but it provides a way to stop it anyway
        cancel();
      }
      else {
        // the delayed thing hasn't started yet
        clearTimeout(timeout);
      }
    }
  }, deps);
}
