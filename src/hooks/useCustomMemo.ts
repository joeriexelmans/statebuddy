import { useRef } from "react";

// author: ChatGPT
export function useCustomMemo<T, DepsType extends unknown[]>(
  compute: () => T,
  deps: DepsType,
  isEqual: (a: DepsType, b: DepsType) => boolean
) {
  const prev = useRef<{ deps: DepsType; value: T }>(null);

  if (!prev.current || !isEqual(deps, prev.current.deps)) {
    prev.current = {
      deps,
      value: compute(),
    };
  }

  return prev.current.value;
}
