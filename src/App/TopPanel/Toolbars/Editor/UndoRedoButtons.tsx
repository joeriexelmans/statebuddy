import { memo } from "react";
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { useShortcuts } from "@/hooks/useShortcuts";
import { UndoCallbacks } from "../../../../hooks/useUndo";
import { DoubleClickButton } from "../../../Components/DoubleClickButton";
import { Tooltip } from "../../../Components/Tooltip";
import { VisualEditorState } from "../../../VisualEditor/VisualEditor.state";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";

export const UndoRedoButtons = memo(function UndoRedoButtons({
  KeyInfo,
  historyCallbacks: {undo, redo, forget},
  historyLength,
  futureLength,
}: {
  KeyInfo: any,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  historyLength: number,
  futureLength: number,
}) {

  useShortcuts([
    {keys: ["Ctrl", "z"], action: undo},
    {keys: ["Ctrl", "Shift", "Z"], action: redo},
  ])

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
    <DoubleClickButton tooltip="forget undo/redo history (saves you some memory)" onDoubleClick={forget} disabled={historyLength === 0 && futureLength === 0}>
      <DeleteOutlineIcon fontSize="small"/>
    </DoubleClickButton>
  </>;
});
