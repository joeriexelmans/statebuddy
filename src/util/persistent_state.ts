import { Dispatch, SetStateAction, useState } from "react";

// like useState, but it is persisted in localStorage
// important: values must be JSON-(de-)serializable
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(() => {
    const recovered = localStorage.getItem(key);
    let parsed;
    if (recovered !== null) {
      try {
        parsed = JSON.parse(recovered);
        return parsed;
      } catch (e) {
        // console.warn(`failed to recover state for option '${key}'`, e,
        //  '(this is normal when running the app for the first time)');
      }
    }
    return initial;
  });

  function setStateWrapped(val: SetStateAction<T>) {
    setState((oldState: T) => {
      let newVal;
      if (typeof val === 'function') {
        // @ts-ignore: i don't understand why 'val' might not be callable
        newVal = val(oldState);
      }
      else {
        newVal = val;
      }
      const serialized = JSON.stringify(newVal);
      localStorage.setItem(key, serialized);
      return newVal;
    });
  }

  return [state, setStateWrapped];
}
