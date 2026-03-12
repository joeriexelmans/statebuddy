import { useUrlHashState } from "@/hooks/useUrlHashState";
import { initialEditorState } from "@/statecharts/concrete_syntax";
import { AppState, defaultAppState } from "../App.state";
import { WithSetters } from "../makePartialSetter";
import { VisualEditorState, SerializableSelection, deserializeEditorState, serializeEditorState } from "../VisualEditor/VisualEditor.state";
import { EditHistory } from "./useEditHistory";
import { useDelay } from "./useDelay";
import { useMemo } from "react";
import { myPureDeepAssign } from "@/util/util";

// valid URL hashes contain:
export type UrlState = {
  editorState: VisualEditorState<SerializableSelection>;
} & Partial<AppState>;

export type ModelSize = {
  original: number,
  compressed: number,
}

export function usePersistentAppState({
  appState, setAppState, editHistory, setEditHistory, delayMs,
}: WithSetters<{ appState: AppState; editHistory: EditHistory | undefined; }> & { delayMs: number; }): ModelSize {
  const [persist, originalSize, compressedSize, state] = useUrlHashState<UrlState>(
    recoveredState => {
      if (recoveredState === undefined) {
        // failed to recover -> reset to default
        setEditHistory(() => ({
          current: initialEditorState,
          history: [],
          future: [],
        }));
      }
      else {
        // recover state
        const { editorState, ...appState } = recoveredState;
        setAppState(() => myPureDeepAssign(defaultAppState, appState));
        setEditHistory(() => ({ current: deserializeEditorState(editorState), history: [], future: [] }));
      }
    }
  );

  useDelay(() => {
    let cancel;
    if (editHistory?.current !== undefined) {
      const urlState = { editorState: serializeEditorState(editHistory.current), ...appState };
      const cancelPromise = new Promise<void>((resolve) => {
        cancel = resolve;
      });
      persist(urlState, cancelPromise);
      return cancel;
    }
  }, delayMs, [editHistory?.current, appState]);

  return useMemo(() => ({original: originalSize, compressed: compressedSize}), [originalSize, compressedSize]);
}
