import { Dispatch, useCallback } from "react";

export function useToggle(booleanSetter: Dispatch<(state: boolean) => boolean>) {
  return useCallback(() => booleanSetter(x => !x), [booleanSetter]);
}
