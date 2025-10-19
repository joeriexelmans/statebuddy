import { Dispatch, ReactElement, SetStateAction, useState } from "react";

import { parse as parseLabel } from "../statecharts/label_parser";

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

  let error = "";
  try {
    const parsed = parseLabel(text);
  } catch (e) {
    error = e.message;
  }

  return <div onKeyDown={onKeyDown} style={{padding: 4, width: 520}}>
    Text label:<br/>
    <textarea autoFocus style={{fontFamily: 'Roboto', width:500, height: 100}} onChange={e=>setText(e.target.value)}>{text}</textarea>
    <br/>
    <span style={{color: 'var(--error-color)'}}>{error}</span><br/>
    <p><kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.
    </p>
    (Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert newline.)
  </div>;
}