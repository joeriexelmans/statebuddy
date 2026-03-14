import { Dispatch, ReactElement, SetStateAction, useState, useCallback, CSSProperties, useMemo } from "react";

import styles from "../App.module.css";

import { useShortcuts } from "@/hooks/useShortcuts";
import { syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText } from "../VisualEditor/SyntaxHiglightedText";
import { SyntaxError } from "@/statecharts/label_parser";

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
    return {
      cssWidth: Math.max(
        50,
        lines.reduce((max, cur) => Math.max(max, cur.length), 0) + 7,
      ) + 'ch',
      cssHeight: Math.max(
        lines.length + 2,
      )*1.5 + 'em',
    }
  }, [text]);

  const maxWidth = `max(${cssWidth}, 100%)`;
  
  return <div style={{padding: 2, display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'center'}}>

    <p>Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert new line.</p>

    <div style={{position: 'relative', textAlign: 'left'}}>
      <pre
        // className={parseError ? styles.error : ""}
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

    <div style={{ minHeight: '3em', color: 'var(--error-color)'}}>
      {parseError && <ShowSyntaxError e={parseError}/>}
    </div>

    <p><kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.</p>
  </div>;
}

type ExpectedPiece = ExpectedClass | ExpectedLiteral;

type ExpectedLiteral = {
  type: "literal",
  text: string,
}

type ExpectedClass = {
  type: "class",
  inverted: boolean,
  parts: string[],
}

export function ShowSyntaxError({e, ...rest}: {e: {expected: ExpectedPiece[]}}) {
  return <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8}} {...rest}>
    <div>Expected:</div>
    <div style={{display: 'flex', flexDirection: 'row', gap: 8, flexWrap: "wrap", alignItems: 'center'}}>
      {e.expected
        .filter(exp => exp.type === "literal")
        .map(exp =>
          <div key={exp.text} style={{...commonStyle, color: 'var(--text-color)', padding: 2}}>
            {exp.text}
          </div>)}
    </div>
  </div>
}