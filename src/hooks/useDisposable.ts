import { useEffect, useMemo } from "react";

// Like useMemo, it can computes a value when dependencies change
// Like useEffect, it can do a cleanup
export function useDisposable<T>(
  // initial: T,
  factory: () => [T, () => void],
  deps: React.DependencyList,
): T | null {
  const [value, cleanup] = useMemo(factory, deps);
  useEffect(() => cleanup, [cleanup]);
  return value;
}
