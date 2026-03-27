import { Tooltip } from "@/App/Components/Tooltip";
import { copySelection, pasteData } from "@/App/VisualEditor/hooks/useCopyPaste";
import { VisualEditorState } from "@/App/VisualEditor/VisualEditor.state";
import { Dispatch, JSXElementConstructor, memo, PropsWithChildren, ReactNode, SetStateAction, useCallback } from "react";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { Vec2D } from "@/util/geometry";

const ShortcutCopy = <><kbd>Ctrl</kbd>+<kbd>C</kbd></>;
const ShortcutPaste = <><kbd>Ctrl</kbd>+<kbd>V</kbd></>;

export const CopyPasteButtons = memo(function CopyPasteButtons({
  current,
  KeyInfo,
  commit,
  startDragging,
}: {
  current: VisualEditorState,
  KeyInfo: JSXElementConstructor<PropsWithChildren<{keyInfo: ReactNode}>>,
  commit: (callback: (s: VisualEditorState) => VisualEditorState) => void,
  startDragging: (where: Vec2D) => void,
}) {
  const disabled = current.selection.size === 0;

  const onCopy = useCallback(() => {
    const item = new ClipboardItem({"text/plain": copySelection(current)});
    navigator.clipboard.write([item]);
  }, [current]);

  const onPaste = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      const where = {x: 500, y: 100};
      pasteData(text, // <-- data to decode
        where, // <-- where on the canvas
        commit, // <-- create new entry in edit history
        () => {})
      startDragging(where); // <-- pasted shapes follow mouse
    });
  }, [commit, startDragging]);

  return <>
    <KeyInfo keyInfo={ShortcutCopy}>
      <Tooltip tooltip='copy'>
        <button
          disabled={disabled}
          onClick={onCopy}>
          <ContentCopyIcon fontSize='small'/>
        </button>
      </Tooltip>
    </KeyInfo>
    <KeyInfo keyInfo={ShortcutPaste}>
      <Tooltip tooltip='paste'>
        <button onClick={onPaste}>
          <ContentPasteIcon fontSize='small'/>
        </button>
      </Tooltip>
    </KeyInfo>
  </>  
})
