import {getTextFatBBox, Text} from "../../statecharts/concrete_syntax";
import { CSSProperties, memo, useMemo } from "react";
import { jsonDeepEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";

import styles from "./VisualEditor.module.css";
import { RangeWithAnnotation, syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText, TextWithLineBreaks } from "./SyntaxHiglightedText";
import { TextRange } from "@/statecharts/label_ast";
import { TraceableError } from "@/statecharts/parser";

const foundStyle = {
  fill: 'light-dark( #f00 , #f00 )',
  strokeWidth: 4,
  stroke: 'light-dark( rgba(255, 141, 211, 1), rgba(109, 0, 100, 1))',
} as CSSProperties;

const fade = (ranges: RangeWithAnnotation[]) => {
  return ranges.map(({style, ...r}) => ({style: ({...style, fill: `color-mix(in srgb, ${style.fill} 50%, var(--text-color) 50%)`}), ...r}));
}

// workaround for not being able to use 'em' and 'ch' CSS units in SVG transformations.
const em = 79/4;
const ch = 40/5;

export const TextSVG = memo(function TextSVG(props: {text: Text, selected: boolean, highlight: boolean, findText: string, beginEdit: (uid: string) => void, error?: TraceableError}) {

  let {
    ranges,
    parseError,
  } = useMemo(() => syntaxHighlight(props.text.text), [props.text.text]);

  const className = styles.draggableText
    + ' ' + (props.selected ? styles.selected : "")
    + ' ' + (props.highlight ? styles.highlight : "")
    + ' ' + (parseError ? styles.error : "");

  const found = findOccurrences(props.text.text, props.findText)
    .map(r => ({...r, style: foundStyle}));

  // when searching, fade all colors so search result highlight is more visible
  if (props.findText) {
    ranges = fade(ranges);
  }

  // We left-align text labels, but we center the whole label around the middle of its bounding box.
  const lines = props.text.text.split('\n');
  const maxLineWidth = lines.reduce((max, cur) => Math.max(max, cur.length), 0);
  const dx = (-maxLineWidth/2)*ch;
  const dy = (-(lines.length-1)/2)*em;

  let errMessage;
  if (parseError) {
    errMessage = parseError.message;
  }
  else if (props.error) {
    errMessage = props.error.message;
  }

  return <>
    <BoundingBox {...getTextFatBBox(props.text)}/>
    <g
      key={props.text.uid}
      transform={`translate(${props.text.topLeft.x} ${props.text.topLeft.y})`}
      onDoubleClick={() => props.beginEdit(props.text.uid)}
    >
      <g transform={`translate(${dx} ${dy})`}>
        {/* our syntax-highlighted text */}
        <text
          className={className}
          data-uid={props.text.uid}
          data-parts="text"
          dominantBaseline="middle"
        >
          <SyntaxHighlightedText
            text={props.text.text}
            ranges={ranges}
            tspan
            disableTooltips
          />
        </text>

        {/* found text highlight - transparent except for the fragments that were found */}
        {found.length > 0 && <text
          className={className}
          data-uid={props.text.uid}
          data-parts="text"
          style={{fill: 'transparent', strokeWidth: 0}}
          dominantBaseline="middle"
        >
          <SyntaxHighlightedText
            text={props.text.text}
            ranges={found}
            tspan
            disableTooltips
          />
        </text>}

        {/* our selection 'helper': invisible except on mouse hover (then draw thick border) */}
        <text
          className={styles.helper + ' ' + styles.draggableText}
          data-uid={props.text.uid}
          data-parts="text"
          style={{whiteSpace: "preserve"}}
          dominantBaseline="middle"
        >
          <TextWithLineBreaks text={props.text.text}/>
        </text>

      </g>

        {/* error - only visible on hover */}
        {errMessage &&
          <text className={styles.errorHover} y={dy-20} textAnchor="middle">
            <tspan>{errMessage}</tspan>
          </text>
        }

      {/* text anchor position - useful for debugging */}
      {/* {props.selected && <>
        <line x1={-2.5} x2={2.5} y1={0} y2={0} stroke="red" strokeWidth={0.5}/>
        <line x1={0} x2={0} y1={-2.5} y2={2.5} stroke="red" strokeWidth={0.5}/>
      </>} */}
      {props.selected && <circle cx={0} cy={0} r={1.5} fill="red" />}
    </g>
  </>;
}, (prevProps, newProps) => {
  return jsonDeepEqual(prevProps.text, newProps)
    && prevProps.highlight === newProps.highlight
    && prevProps.beginEdit === newProps.beginEdit
    && prevProps.selected === newProps.selected
    && prevProps.findText === newProps.findText
});

// Author: ChatGPT
export function findOccurrences(str: string, sub: string) {
  const results = [] as TextRange[];
  if (!sub) return results;

  let index = 0;

  while ((index = str.indexOf(sub, index)) !== -1) {
    results.push({ start: index, end: index + sub.length });
    index += sub.length; // move past this match
  }

  return results;
}
