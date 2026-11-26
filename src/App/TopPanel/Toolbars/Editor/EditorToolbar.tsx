import { memo, useCallback } from "react";
import { UndoCallbacks } from "../../../../hooks/useUndo";
import { rotateSelection } from "../../../VisualEditor/transformations/rotate";
import { VisualEditorState } from "../../../VisualEditor/VisualEditor.state";
import { Toolbar } from "../../Toolbar";
import { CopyPasteButtons, PasteCallback } from "./CopyPasteButtons";
import { RotateButtons } from "./RotateButtons";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { SyntaxStateV4 } from "@/App/migrations/v4_types";

type EditorToolbarProps = {
  KeyInfo: any,
  syntax: SyntaxStateV4,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  paste: PasteCallback,
}

const toolbarGap = {columnGap: '1em'};

export const EditorToolbar = memo(function EditorToolbar({syntax, KeyInfo, historyCallbacks, paste}: EditorToolbarProps) {
  return <Toolbar style={toolbarGap}>
    {/* undo / redo */}
    <Toolbar>
      <UndoRedoButtons
        KeyInfo={KeyInfo}
        historyCallbacks={historyCallbacks}
        historyLength={syntax.editorState.history.length}
        futureLength={syntax.editorState.future.length}
      />
    </Toolbar>

    {/* copy / paste */}
    <Toolbar>
      <CopyPasteButtons
        // @ts-ignore
        KeyInfo={KeyInfo}
        current={syntax.editorState.current}
        commit={historyCallbacks.commit}
        paste={paste}
      />
    </Toolbar>

    {/* rotate */}
    <Toolbar>
      <RotateButtons
        disabled={syntax.editorState.current.selection.size === 0}
        onRotate={useCallback((direction: "ccw"|"cw") =>
          historyCallbacks.commit(editorState =>
            rotateSelection(editorState, direction)),
          [historyCallbacks.commit])}
      />
    </Toolbar>
  </Toolbar>
});
