import { useEffect } from "react";


export function useDelay(
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
      if (cancel) {
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
