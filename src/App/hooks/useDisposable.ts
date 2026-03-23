import { Dispatch, SetStateAction, useEffect, useState } from "react";

// Like useMemo, it can compute a value when dependencies change
// Like useEffect, it can do a cleanup
export function useDisposable<T>(
  initial: T,
  factory: (setter: Dispatch<SetStateAction<T|null>>) => () => void,
  deps: React.DependencyList,
): T | null {
  const [value, setValue] = useState<T | null>(initial);

  useEffect(() => {
    const dispose = factory(setValue);
    return dispose;
  }, deps);

  return value;
}
