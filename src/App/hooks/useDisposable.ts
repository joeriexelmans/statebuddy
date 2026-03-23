import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function useDisposable<T>(
  factory: (setter: Dispatch<SetStateAction<T|null>>) => () => void,
  deps: React.DependencyList
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const dispose = factory(setValue);
    return dispose;
  }, deps);

  return value;
}
