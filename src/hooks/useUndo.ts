import { Dispatch, SetStateAction, useMemo } from "react";

export type UndoState<T> = {
  history: ReadonlyArray<T>, // items closer to the start of array are further in the past
  current: T,
  future: ReadonlyArray<T>, // items further towards the end of array are further into the future
}

export type UndoCallbacks<T> = {
  commit: Dispatch<SetStateAction<T>>,
  replace: Dispatch<SetStateAction<T>>,
  forget: () => void,
  undo: () => void,
  redo: () => void,
};

function callIfFn<T>(callback: SetStateAction<T>, oldValue: T) {
  if (typeof callback === "function") {
    // @ts-ignore
    return callback(oldValue);
  }
  return callback;
}

export function useUndo<T>(setState: Dispatch<SetStateAction<UndoState<T>>>) {

  const callbacks = useMemo(() => {
    // creates new entry in undo history
    // future is lost
    const commit: Dispatch<SetStateAction<T>> = (callback) => {
      setState(({history, current}) => {
        return {
          history: [...history, current],
          current: callIfFn(callback, current),
          future: [], // <-- forget future :(
        };
      });
    };

    // overwrites last entry in undo history
    // we do this while dragging shapes: if every mouse move event would create a new history entry, our history would get quite polluted.
    const replace: Dispatch<SetStateAction<T>> = (callback) => {
      setState(({history, current}) => ({
        history,
        current: callIfFn(callback, current),
        future: [], // <-- forget future :(
      }));
    };

    const forget = () => {
      setState(({current}) => ({
        history: [],
        current,
        future: [],
      }));
    }

    const undo = () => {
      setState(state => {
        if (state.history.length > 0) {
          const {history, current, future} = state;
          return {
            history: history.slice(0, -1),
            current: history.at(-1)!,
            future: [current, ...future],
          }
        }
        return state;
      });
    };

    const redo = () => {
      setState(state => {
        if (state.future.length > 0) {
          const {history, current, future} = state;
          return {
            history: [...history, current],
            current: future[0],
            future: future.slice(1),
          }
        }
        return state;
      });
    };

    return {
      commit,
      replace,
      forget,
      undo,
      redo,
    } as UndoCallbacks<T>;

  }, [setState]);

  return callbacks;
}
