import { Dispatch, SetStateAction, useCallback, useMemo } from "react";

export function makePartialSetter<T, K extends keyof T>(fullSetter: Dispatch<SetStateAction<T>>, key: K): Dispatch<SetStateAction<T[typeof key]>> {
  return (newValueOrCallback: T[K] | ((newValue: T[K]) => T[K])) => {
    fullSetter(oldFullValue => {
      const newValue = (typeof newValueOrCallback === 'function') ? (newValueOrCallback as (newValue: T[K]) => T[K])(oldFullValue[key] as T[K]) : newValueOrCallback as T[K];
      if (newValue === oldFullValue[key]) {
        return oldFullValue;
      }
      else {
        return {
          ...oldFullValue,
          [key]: newValue,
        }
      }
    })
  };
}

export type Setters<T extends {[key: string]: any}> = {
  [K in keyof T as `set${Capitalize<Extract<K, string>>}`]: Dispatch<SetStateAction<T[K]>>;
}

export function makeAllSetters<T extends {[key: string]: any}>(
  fullSetter: Dispatch<SetStateAction<T>>,
  keys: (keyof T)[],
): Setters<T> {
  // @ts-ignore
  return useMemo(() => {
    console.log('creating setters for App');
    // @ts-ignore
    return Object.fromEntries(keys.map((key: string) => {
      return [`set${key.charAt(0).toUpperCase()}${key.slice(1)}`, makePartialSetter(fullSetter, key)];
    }));
  }, [fullSetter]);
}
