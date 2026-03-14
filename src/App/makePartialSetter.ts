import { Dispatch, SetStateAction, useCallback, useMemo } from "react";

export function makePartialSetter<T, K extends keyof T>(fullSetter: Dispatch<SetStateAction<T>>, key: K): Dispatch<SetStateAction<T[typeof key]>> {
  return (newValueOrCallback: T[K] | ((oldValue: T[K]) => T[K])) => {
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

export type WithSetters<T extends {[key: string]: any}> = T & Setters<T>;

export function makeAllSetters<T extends {[key: string]: any}>(
  fullSetter: Dispatch<SetStateAction<T>>,
  keys: (keyof T)[],
): Setters<T> {
  // @ts-ignore
  return useMemo(() => {
    // @ts-ignore
    return Object.fromEntries(keys.map((key: string) => {
      return [`set${key.charAt(0).toUpperCase()}${key.slice(1)}`, makePartialSetter(fullSetter, key)];
    }));
  }, [fullSetter]);
}


export function makePartialArraySetter<T>(fullSetter: Dispatch<SetStateAction<T[]>>, idx: number) {
  return (newValueOrCallback: T | ((oldValue: T) => T)) => {
    fullSetter(oldFullValue => {
      let newValue;
      if (typeof newValueOrCallback === 'function') {
        // @ts-ignore
        newValue = newValueOrCallback(oldFullValue[idx]);
      }
      else {
        newValue = newValueOrCallback;
      }
      return oldFullValue.with(idx, newValue);
    });
  }
}