import { Dispatch, ReactElement, SetStateAction, useState, useCallback, CSSProperties, useMemo } from "react";

import styles from "../App.module.css";

import { useShortcuts } from "@/hooks/useShortcuts";
import { syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText } from "../VisualEditor/SyntaxHiglightedText";

const commonStyle = {
  padding: 4,
  fontFamily: "'Droid Sans Mono', monospace",
  fontSize: '10pt',
  border:'1px solid var(--separator-color)',
  textAlign: 'left',
  boxSizing: 'border-box',
} as CSSProperties;

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

  const {
    ranges,
    parseError,
  } = syntaxHighlight(text);

  const {cssWidth, cssHeight} = useMemo(() => {
    const lines = text.split('\n');
    console.log({lines});
    return {
      cssWidth: Math.max(
        50,
        lines.reduce((max, cur) => Math.max(max, cur.length), 0) + 2,
      ) + 'ch',
      cssHeight: Math.max(
        6,
        lines.length + 1,
      )*1.5 + 'em',
    }
  }, [text]);
  
  return <div style={{padding: 20}}>
    Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert new line.
    <br/>
    <br/>
    <div style={{position: 'relative'}}>
      <pre
        className={parseError ? styles.error : ""}
        style={{...commonStyle,
          position: 'absolute',
          pointerEvents: 'none',
          width: cssWidth,
          height: cssHeight,
          overflow: "hidden",
        }}>
        <SyntaxHighlightedText text={text} ranges={ranges}/>
      </pre>
      <textarea
        autoFocus
        style={{...commonStyle,
          position: 'relative',
          color: 'transparent',
          backgroundColor: 'transparent',
          caretColor: 'var(--text-color)',
          resize: 'none',
          width: cssWidth,
          height: cssHeight,
          overflow: "hidden",
        }}
        onChange={e=>setText(e.target.value)}
        value={text}
        onFocus={e => e.target.select()}
        spellCheck={false}
        />
    </div>
    <br/>
    <br/>
    <kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.
  </div>;
}
