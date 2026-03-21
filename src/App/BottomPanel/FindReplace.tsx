import { Dispatch, FormEvent, SetStateAction, useCallback } from "react";

import CloseIcon from '@mui/icons-material/Close';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { Tooltip } from "../Components/Tooltip";
import { FindReplaceState } from "../migrations/v1_types";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";


type FindReplaceProps = {
  state: FindReplaceState,
  setState: Dispatch<SetStateAction<FindReplaceState>>,
  cs: VisualEditorState,
  setCS: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
  hide: () => void,
};

export function FindReplace({state: {findText, replaceText}, setState, cs, setCS, hide}: FindReplaceProps) {
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
    setState(({findText, replaceText}) => ({replaceText: findText, findText: replaceText}));
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
          onChange={e  => setState(s => ({...s, findText: e.target.value}))}
          style={{flexGrow: 1, minWidth: 20}}/>
        <input tabIndex={0} placeholder="replace"
          value={replaceText}
          onChange={e => setState(s => ({...s, replaceText: e.target.value}))}
          style={{flexGrow: 1, minWidth: 20}}/>
      </div>
      <div style={{flex: '0 0 content'}}>
        <div>
          <Tooltip tooltip="swap fields" above={true}>
            <button
                type="button" // <-- prevent form submission on click
                onClick={onSwap}
                style={{width: 50}}>
              <SwapVertIcon fontSize="small"/>
            </button>
          </Tooltip>
          <Tooltip tooltip="hide" above={true}>
            <button
                type="button" // <-- prevent form submission on click
                onClick={hide}
                style={{width: 50}}
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