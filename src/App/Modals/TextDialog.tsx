import { Dispatch, ReactElement, SetStateAction, useState, useCallback } from "react";

import { cachedParseLabel } from "@/statecharts/parser";
import { useShortcuts } from "@/hooks/useShortcuts";

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

  let parseError = "";
  try {
    cachedParseLabel(text);
  } catch (e) {
    // @ts-ignore
    parseError = e.message;
  }

  return <div style={{padding: 4}}>
    {/* Text label:<br/> */}
    <textarea autoFocus style={{fontFamily: 'Roboto', width: 400, height: 60}} onChange={e=>setText(e.target.value)} value={text} onFocus={e => e.target.select()}/>
    <br/>
    <span style={{color: 'var(--error-color)'}}>{parseError}</span><br/>
    {/* <p> */}
      <kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.
    {/* </p> */}
    {/* <br/> */}
    {/* (Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert newline.) */}
  </div>;
}
