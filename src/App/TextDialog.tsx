import { Dispatch, ReactElement, SetStateAction, useState, KeyboardEvent, useEffect, useRef } from "react";

import { cachedParseLabel } from "@/statecharts/parser";

export function TextDialog(props: {setModal: Dispatch<SetStateAction<ReactElement|null>>, text: string, done: (newText: string|undefined) => void}) {
  const [text, setText] = useState(props.text);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (!e.shiftKey) {
        e.preventDefault();
        props.done(text);
        props.setModal(null);
      }
    }
    if (e.key === "Escape") {
      props.setModal(null);
      e.stopPropagation();
    }
    e.stopPropagation();
  }

  let parseError = "";
  try {
    cachedParseLabel(text);
  } catch (e) {
    // @ts-ignore
    parseError = e.message;
  }

  return <div onKeyDown={onKeyDown} style={{padding: 4}}>
    Text label:<br/>
    <textarea autoFocus style={{fontFamily: 'Roboto', width: 400, height: 60}} onChange={e=>setText(e.target.value)} value={text} onFocus={e => e.target.select()}/>
    <br/>
    <span style={{color: 'var(--error-color)'}}>{parseError}</span><br/>
    <p><kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.
    </p>
    (Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert newline.)
  </div>;
}