import { memo } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

export const UndoRedoButtons = memo(function UndoRedoButtons({showKeys, onUndo, onRedo, historyLength, futureLength}: {showKeys: boolean, onUndo: () => void, onRedo: () => void, historyLength: number, futureLength: number}) {
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Z</kbd></>}>
      <button title="undo" onClick={onUndo} disabled={historyLength === 0}><UndoIcon fontSize="small"/>&nbsp;({historyLength})</button>
    </KeyInfo>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></>}>
      <button title="redo" onClick={onRedo} disabled={futureLength === 0}><RedoIcon fontSize="small"/>&nbsp;({futureLength})</button>
    </KeyInfo>
  </>;
});
