import { Dispatch, FormEvent, SetStateAction, useCallback } from "react";
import { VisualEditorState } from "../VisualEditor/VisualEditor";

import CloseIcon from '@mui/icons-material/Close';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { Tooltip } from "../Components/Tooltip";

type FindReplaceProps = {
  findText: string,
  replaceText: string,
  setFindReplaceText: Dispatch<SetStateAction<[string, string]>>,
  cs: VisualEditorState,
  setCS: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
  hide: () => void,
};

export function FindReplace({findText, replaceText, setFindReplaceText, cs, setCS, hide}: FindReplaceProps) {
  const onReplace = useCallback(() => {
    setCS(cs => {
      return {
        ...cs,
        texts: cs.texts.map(txt => ({
          ...txt,
          text: txt.text.replaceAll(findText, replaceText)
        })),
      };
    });
  }, [findText, replaceText, setCS]);

  const onSwap = useCallback(() => {
    setFindReplaceText(([findText, replaceText]) => [replaceText, findText]);
  }, [findText, replaceText]);

  const onSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onReplace();
    // onSwap();
  }, [findText, replaceText, onSwap, onReplace]);

  const n = findText === "" ? 0 : cs.texts.reduce((count, txt) => count+(txt.text.indexOf(findText) !== -1 ? 1: 0), 0);

  return <form onSubmit={onSubmit}>
    <div className="toolbar toolbarGroup" style={{display: 'flex', flexDirection: 'row'}}>
      <div style={{flexGrow:1, display: 'flex', flexDirection: 'column'}}>
        <input placeholder="find"
          value={findText}
          onChange={e  => setFindReplaceText(([_, replaceText]) => [e.target.value, replaceText])} 
          style={{flexGrow: 1, minWidth: 20}}/>
        <input tabIndex={0} placeholder="replace"
          value={replaceText}
          onChange={(e => setFindReplaceText(([findText, _]) => [findText, e.target.value]))}
          style={{flexGrow: 1, minWidth: 20}}/>
      </div>
      <div style={{flex: '0 0 content'}}>
        <div>
          <Tooltip tooltip="swap fields" above={true}>
            <button
                type="button" // <-- prevent form submission on click
                onClick={onSwap}
                style={{width: 40}}>
              <SwapVertIcon fontSize="small"/>
            </button>
          </Tooltip>
          <Tooltip tooltip="hide" above={true}>
            <button
                type="button" // <-- prevent form submission on click
                onClick={hide}
                style={{width: 60}}
                >
              <CloseIcon fontSize="small"/>
            </button>
          </Tooltip>
        </div>
        <Tooltip tooltip="replace all occurrences in model" 
          align="right"
          above={true}>
        <input type="submit"
            disabled={n===0}
            value={`replace all (${n})`}
            style={{height: 26, width: 100}}/>
        </Tooltip>
      </div>
    </div>
  </form>;
}