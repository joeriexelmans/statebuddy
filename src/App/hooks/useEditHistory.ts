import { Dispatch, SetStateAction, useMemo } from "react";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

export type EditHistoryCallbacks = {
  commitState: (callback: (oldState: VisualEditorState) => VisualEditorState) => void,
  replaceState: (callback: (oldState: VisualEditorState) => VisualEditorState) => void,
  undo: () => void,
  redo: () => void,
};

export function useEditHistory(
  setEditHistory: Dispatch<SetStateAction<EditHistory|undefined>>,
): EditHistoryCallbacks {

  return useMemo(() => {
    // creates new entry in undo history
    // future is lost
    const commitState = (callback: (oldState: VisualEditorState) => VisualEditorState) => {
      setEditHistory(historyState => {
        if (historyState === undefined) return undefined; // no change
        const newEditorState = callback(historyState.current);
        return {
          current: newEditorState,
          history: [...historyState.history, historyState.current],
          future: [],
        };
      });
    };

    // overwrites last entry in undo history
    // we do this while dragging shapes: if every mouse move event would create a new history entry, our history would get quite polluted.
    const replaceState = (callback: (oldState: VisualEditorState) => VisualEditorState) => {
      setEditHistory(historyState => {
        if (historyState === undefined) return undefined; // no change
        const newEditorState = callback(historyState.current);
        return {
          ...historyState,
          current: newEditorState,
        };
      });
    };

    const undo = () => {
      setEditHistory(historyState => {
        if (historyState === undefined) return undefined;
        if (historyState.history.length === 0) {
          return historyState; // no change
        }
        return {
          current: historyState.history.at(-1)!,
          history: historyState.history.slice(0,-1),
          future: [...historyState.future, historyState.current],
        }
      })
    };

    const redo = () => {
      setEditHistory(historyState => {
        if (historyState === undefined) return undefined;
        if (historyState.future.length === 0) {
          return historyState; // no change
        }
        return {
          current: historyState.future.at(-1)!,
          history: [...historyState.history, historyState.current],
          future: historyState.future.slice(0,-1),
        }
      });
    };

    return {
      commitState,
      replaceState,
      undo,
      redo,
    };

  }, [setEditHistory]);
}