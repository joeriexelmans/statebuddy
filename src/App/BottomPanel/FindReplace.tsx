import { Dispatch, useCallback, useEffect } from "react";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { usePersistentState } from "@/hooks/usePersistentState";

import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

type FindReplaceProps = {
  setCS: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
  // setModal: (modal: null) => void;
  hide: () => void,
};

export function FindReplace({setCS, hide}: FindReplaceProps) {
  const [findTxt, setFindText] = usePersistentState("findTxt", "");
  const [replaceTxt, setReplaceTxt] = usePersistentState("replaceTxt", "");

  const onReplace = useCallback(() => {
    setCS(cs => {
      return {
        ...cs,
        texts: cs.texts.map(txt => ({
          ...txt,
          text: txt.text.replaceAll(findTxt, replaceTxt)
        })),
      };
    });
  }, [findTxt, replaceTxt]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onReplace();
      // setModal(null);
    }
  }, [onReplace]);

  const onSwap = useCallback(() => {
    setReplaceTxt(findTxt);
    setFindText(replaceTxt);
  }, [findTxt, replaceTxt]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    }
  }, [])

  return <div className="toolbar toolbarGroup" style={{display: 'flex'}}>
    <input placeholder="find" value={findTxt} onChange={e  => setFindText(e.target.value)} style={{width:300}}/>
    <button tabIndex={-1} onClick={onSwap}><SwapHorizIcon fontSize="small"/></button>
    <input tabIndex={0} placeholder="replace" value={replaceTxt} onChange={(e => setReplaceTxt(e.target.value))} style={{width:300}}/>
    &nbsp;
    <button onClick={onReplace}>replace all</button>
    <button onClick={hide} style={{marginLeft: 'auto'}}><CloseIcon fontSize="small"/></button>
  </div>;
}