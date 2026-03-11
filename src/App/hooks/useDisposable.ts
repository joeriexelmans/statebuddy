import { useEffect, useState } from "react";

export function useDisposable<T>(
  factory: () => [T, () => void],
  deps: React.DependencyList
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const [resource, dispose] = factory();
    setValue(resource);

    return dispose;
  }, deps);

  return value;
}
