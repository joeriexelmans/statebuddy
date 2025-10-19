import { Dispatch, ReactElement, SetStateAction, useState } from "react";

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
  return <span onKeyDown={onKeyDown} style={{backgroundColor:'white'}}>
    <textarea style={{fontFamily: 'Roboto', width:500, height: 100}} onChange={e=>setText(e.target.value)}>{text}</textarea>
    <br/>
    <span style={{backgroundColor:'lightyellow'}}>
    Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert newline.
    </span>
  </span>;
}