import { Dispatch, FormEvent, KeyboardEventHandler, SetStateAction, useCallback } from "react";

import CloseIcon from '@mui/icons-material/Close';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';

import { Tooltip } from "../Components/Tooltip";
import { FindReplaceStateV1 } from "../migrations/v1_types";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { Text } from "@/languages/statecharts/concrete_syntax";
import { KeyInfoVisible, KeyInfoHidden } from "../TopPanel/KeyInfo";

type FindReplaceProps = {
  showKeys: boolean,
  state: FindReplaceStateV1,
  setState: Dispatch<SetStateAction<FindReplaceStateV1>>,
  cs: VisualEditorState,
  setCS: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
  hide: () => void,
};

function numOccurrences(txts: Text[], findText: string) {
  if (findText === "") return 0;
  return txts.reduce(
    (count, txt) => count+(txt.text.indexOf(findText) !== -1 ? 1: 0),
    0,
  );
}

export function FindReplace({showKeys, state: {findText, replaceText}, setState, cs, setCS, hide}: FindReplaceProps) {
  const selectedTexts = [...cs.selection].map(([uid, parts]) => parts.has("text") && cs.texts.find(el => el.uid === uid)!).filter(x => x!==false);

  const numGlobal = numOccurrences(cs.texts, findText);
  const numSelection = numOccurrences(selectedTexts, findText);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  const doReplace = (onlySelection: boolean) => {
    setCS(cs => {
      return {
        ...cs,
        texts: cs.texts.map(txt => ({
          ...txt,
          text: (!onlySelection || selectedTexts.includes(txt))
            ? txt.text.replaceAll(findText, replaceText)
            : txt.text,
        })),
      };
    });
  };

  const onSwap = useCallback(() => {
    setState(({findText, replaceText}) => ({replaceText: findText, findText: replaceText}));
  }, [findText, replaceText]);

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      e.preventDefault();
      if (e.shiftKey) {
        doReplace(true)
      }
      else {
        doReplace(false);
      }
    }
    else if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      hide();
    }
  }

  return (
    <div className="toolbar toolbarGroup" style={{display: 'flex', flexDirection: 'row'}}
      onKeyDown={onKeyDown}>
      <div style={{flexGrow:1, display: 'flex', flexDirection: 'column'}}>
        <input placeholder="find"
          autoFocus
          onFocus={e => e.target.select()}
          value={findText}
          onChange={e  => setState(s => ({...s, findText: e.target.value}))}
          style={{flexGrow: 1, minWidth: 20}}/>
        <input tabIndex={0} placeholder="replace"
          onFocus={e => e.target.select()}
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
          <KeyInfo keyInfo={<kbd>Esc</kbd>}>
            <Tooltip tooltip="hide" above={true}>
              <button
                  type="button" // <-- prevent form submission on click
                  onClick={hide}
                  style={{width: 50}}
                  >
                <CloseIcon fontSize="small"/>
              </button>
            </Tooltip>
          </KeyInfo>
        </div>
        <KeyInfo keyInfo={<><kbd>Shift</kbd>+<kbd>Enter</kbd></>}>
          <Tooltip tooltip={`replace ${numSelection} occurrences in selection\n<Shift>+<Enter>`} align="right" above>
            <button type="button"
              style={{width: 50}}
              disabled={numSelection===0}
              onClick={() => doReplace(true)}
              >
                <HighlightAltIcon/>
                {numSelection}
            </button>
          </Tooltip>
        </KeyInfo>
        <KeyInfo keyInfo={<kbd>Enter</kbd>}>
          <Tooltip tooltip={`replace ${numGlobal} occurrences in model\n<Enter>`}
            align="right"
            above>
            <button type="button"
              disabled={numGlobal===0}
              style={{height: 26, width: 50}}
              onClick={() => doReplace(false)}
              >
                <FindReplaceIcon/>
                {numGlobal}
            </button>
          </Tooltip>
        </KeyInfo>
      </div>
    </div>
  );
}