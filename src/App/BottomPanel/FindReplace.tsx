import { Dispatch, useCallback, useEffect } from "react";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { usePersistentState } from "@/hooks/usePersistentState";

import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useShortcuts } from "@/hooks/useShortcuts";

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

  useShortcuts([
    {keys: ["Enter"], action: onReplace},
  ])

  const onSwap = useCallback(() => {
    setReplaceTxt(findTxt);
    setFindText(replaceTxt);
  }, [findTxt, replaceTxt]);

  return <div className="toolbar toolbarGroup" style={{display: 'flex'}}>
    <input placeholder="find" value={findTxt} onChange={e  => setFindText(e.target.value)} style={{width:300}}/>
    <button tabIndex={-1} onClick={onSwap}><SwapHorizIcon fontSize="small"/></button>
    <input tabIndex={0} placeholder="replace" value={replaceTxt} onChange={(e => setReplaceTxt(e.target.value))} style={{width:300}}/>
    &nbsp;
    <button onClick={onReplace}>replace all</button>
    <button onClick={hide} style={{marginLeft: 'auto'}}><CloseIcon fontSize="small"/></button>
  </div>;
}