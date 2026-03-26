import { memo, useCallback } from "react";
import { UndoCallbacks } from "../../../../hooks/useUndo";
import { Vec2D } from "../../../../util/geometry";
import { SyntaxStateV3 } from "../../../migrations/v3_types";
import { rotateSelection } from "../../../VisualEditor/transformations/rotate";
import { VisualEditorState } from "../../../VisualEditor/VisualEditor.state";
import { Toolbar } from "../../Toolbar";
import { CopyPasteButtons } from "./CopyPasteButtons";
import { RotateButtons } from "./RotateButtons";
import { UndoRedoButtons } from "./UndoRedoButtons";

type EditorToolbarProps = {
  KeyInfo: any,
  syntax: SyntaxStateV3,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  startDragging: (where: Vec2D) => void,
}

const toolbarGap = {columnGap: '1em'};

export const EditorToolbar = memo(function EditorToolbar({syntax, KeyInfo, historyCallbacks, startDragging}: EditorToolbarProps) {
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
        startDragging={startDragging}
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
