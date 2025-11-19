import { Dispatch, ReactElement, SetStateAction, useState, useCallback } from "react";

import { cachedParseLabel } from "@/statecharts/parser";
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";

export function TextDialog(props: {setModal: Dispatch<SetStateAction<ReactElement|null>>, text: string, done: (newText: string|undefined) => void}) {
  const [text, setText] = useState(props.text);

  useShortcuts([
    {keys: ["Enter"], action: useCallback(() => {
        props.done(text);
        props.setModal(null);
      }, [text, props.done, props.setModal])},
    {keys: ["Escape"], action: useCallback(() => {
        props.setModal(null);
      }, [props.setModal])},
  ], false);

  let parseError: string | undefined;
  try {
    cachedParseLabel(text);
  } catch (e) {
    // @ts-ignore
    parseError = e.message;
  }

  return <div style={{padding: 20}}>
    Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert new line.
    <br/>
    <br/>
    <Tooltip tooltip={parseError} error={true} align="left" showWhen="focus">
    <textarea
      className={parseError ? "error" : ""}
      autoFocus
      style={{fontFamily: 'Roboto', width: 400, height: 60, boxSizing: 'border-box', border:'1px solid'}}
      onChange={e=>setText(e.target.value)}
      value={text}
      onFocus={e => e.target.select()}
      />
    </Tooltip>
    <br/>
    <br/>
    <kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.
  </div>;
}
