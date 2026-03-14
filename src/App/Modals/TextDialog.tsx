import { Dispatch, ReactElement, SetStateAction, useState, useCallback, CSSProperties, useMemo } from "react";

import { useShortcuts } from "@/hooks/useShortcuts";
import { syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText } from "../VisualEditor/SyntaxHiglightedText";
import { Tooltip } from "../Components/Tooltip";
import { Overlay } from "../Components/Overlay";

export const codeStyle = {
  padding: 4,
  fontFamily: "'Droid Sans Mono', monospace",
  fontSize: '10pt',
  border: '1px solid var(--separator-color)',
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
  
  return <div style={{padding: 2, display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'center'}}>

    <p>Tip: <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert new line.</p>

    <Overlay background={
      <pre
        style={{...codeStyle,
          pointerEvents: 'none',
          width: cssWidth,
          height: cssHeight,
          overflow: "hidden",
        }}>
        <SyntaxHighlightedText text={text} ranges={ranges}/>
      </pre>
    }>
      <textarea
        autoFocus
        style={{...codeStyle,
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
    </Overlay>

    <div style={{ minHeight: '3em', color: 'var(--error-color)'}}>
      {parseError && <ShowSyntaxError e={parseError}/>}
    </div>

    <p><kbd>Enter</kbd> to confirm. <kbd>Esc</kbd> to cancel.</p>
  </div>;
}

type ExpectedPiece = ExpectedClass | ExpectedLiteral | ExpectedOther | ExpectedEnd;

type ExpectedLiteral = {
  type: "literal",
  text: string,
}

type ExpectedClass = {
  type: "class",
  inverted: boolean,
  parts: string[],
}

type ExpectedOther = {
  type: "other",
  description: string,
}

type ExpectedEnd = {
  type: "end",
}

export function ShowSyntaxError({e, ...rest}: {e: {expected: ExpectedPiece[]}}) {
  const alreadySeen = new Set<string>();
  return <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8}} {...rest}>
    <div>Expected:</div>
    <div style={{display: 'flex', flexDirection: 'row', gap: 8, flexWrap: "wrap", alignItems: 'center'}}>
      {e.expected
        // remove duplicates (bug in Peggy?)
        .filter(piece => {
          const key = piece2Key(piece);
          if (alreadySeen.has(key)) return false;
          alreadySeen.add(key);
          return true;
        })
        .map(piece => <ShowExpectedPiece key={piece2Key(piece)} piece={piece}/>)}
    </div>
  </div>
}

function piece2Key(piece: ExpectedPiece) {
  if (piece.type === "literal") {
    return "lit-" + piece.text;
  }
  else if (piece.type === "class") {
    return "cls-" + piece.parts.join('-');
  }
  else if (piece.type === "other") {
    return "oth-" + piece.description;
  }
  else if (piece.type === "end") {
    return "end";
  }
  throw new Error("unreachable");
}

const litStyle = {...codeStyle, color: 'var(--text-color)', padding: 2};
const clsStyle = {...codeStyle, color: 'var(--text-color)', padding: 2, backgroundColor: 'var(--separator-color'};
const othStyle = {...codeStyle, color: 'var(--text-color)', padding: 2, backgroundColor: 'var(--separator-color'};
const endStyle = {...codeStyle, color: 'var(--text-color)', padding: 2, backgroundColor: 'lightyellow'};


export function ShowExpectedPiece({piece}: {piece: ExpectedPiece}) {
  if (piece.type === "literal") {
    return <Tooltip tooltip="token">
      <div style={litStyle}>
        {piece.text}
      </div>
    </Tooltip>;
  }
  else if (piece.type === "class") {
    return <Tooltip tooltip="any of these">
      <div style={clsStyle}>
        [{piece.parts.join('')}]
      </div>
    </Tooltip>;
  }
  else if (piece.type === "other") {
    return <div style={othStyle}>
      {piece.description}
    </div>;
  }
  else if (piece.type === "end") {
    return <Tooltip tooltip="end of input">
      <div style={endStyle}>
        &lt;EOF&gt;
      </div>
    </Tooltip>
  }
}