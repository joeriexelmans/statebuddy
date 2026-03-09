import { memo, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "../KeyInfo";

import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../../Components/Tooltip";
import { EditHistoryCallbacks } from "@/App/hooks/useEditHistory";

export const UndoRedoButtons = memo(function UndoRedoButtons({
  showKeys,
  historyCallbacks: {undo, redo},
  historyLength,
  futureLength,
}: {
  showKeys: boolean,
  historyCallbacks: EditHistoryCallbacks,
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
  </>;
});
