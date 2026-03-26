import { memo } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "../KeyInfo";

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../../Components/Tooltip";
import { UndoCallbacks } from "@/hooks/useUndo";
import { VisualEditorState } from "../../VisualEditor/VisualEditor.state";
import { DoubleClickButton } from "../../Components/DoubleClickButton";
import { Toolbar } from "../Toolbar";

export const UndoRedoButtons = memo(function UndoRedoButtons({
  showKeys,
  historyCallbacks: {undo, redo, forget},
  historyLength,
  futureLength,
}: {
  showKeys: boolean,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  historyLength: number,
  futureLength: number,
}) {

  useShortcuts([
    {keys: ["Ctrl", "z"], action: undo},
    {keys: ["Ctrl", "Shift", "Z"], action: redo},
  ])

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Z</kbd></>}>
      <Tooltip tooltip="undo">
        <button onClick={undo} disabled={historyLength === 0}>
          <UndoIcon fontSize="small"/>&nbsp;({historyLength})
        </button>
      </Tooltip>
    </KeyInfo>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></>}>
      <Tooltip tooltip="redo">
        <button onClick={redo} disabled={futureLength === 0}>
          <RedoIcon fontSize="small"/>&nbsp;({futureLength})
        </button>
      </Tooltip>
    </KeyInfo>
    &nbsp;
    <Toolbar>
    <DoubleClickButton tooltip="forget undo/redo history (saves you some memory)" onDoubleClick={forget} disabled={historyLength === 0 && futureLength === 0}>
      <DeleteOutlineIcon fontSize="small"/>
    </DoubleClickButton>
    </Toolbar>
  </>;
});
