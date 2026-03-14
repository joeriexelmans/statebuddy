import { useCallback, useEffect, useState } from "react";

// can be in two states: not kicked (initially) and kicked.
// if you kick it, it becomes kicked
// after 'delay' duration of not being kicked, it is always not kicked.
export function useKicker(delay: number) {
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (kicked) {
      const timeout = setTimeout(() => {
        setKicked(false);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [kicked]);

  const kick = useCallback(() => setKicked(true), []);

  return [kicked, kick] as const;
}
