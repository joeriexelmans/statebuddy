import { TextDialog } from "@/App/Modals/TextDialog";
import {getTextFatBBox, Text} from "../../statecharts/concrete_syntax";
import { CSSProperties, Dispatch, memo, ReactElement, SetStateAction, useMemo } from "react";
import { jsonDeepEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";

import styles from "./VisualEditor.module.css";
import { RangeWithAnnotation, syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText, TextWithLineBreaks } from "./SyntaxHiglightedText";
import { TextRange } from "@/statecharts/label_ast";

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

export const TextSVG = memo(function TextSVG(props: {text: Text, selected: boolean, highlight: boolean, onEdit: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>, findText: string}) {

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

  return <>
    <BoundingBox {...getTextFatBBox(props.text)}/>
    <g
      key={props.text.uid}
      transform={`translate(${props.text.topLeft.x} ${props.text.topLeft.y})`}
      onDoubleClick={() => {
        props.setModal(<TextDialog setModal={props.setModal} text={props.text.text} done={newText => {
            if (newText) {
              props.onEdit(props.text, newText);
            }
        }} />)
      }}>
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
        {parseError &&
          <text className={styles.errorHover} y={dy-20} textAnchor="middle">
            <tspan>{parseError.message}</tspan>
          </text>
        }

      {/* text anchor position - useful for debugging */}
      {props.selected && <circle cx={0} cy={0} r={1.5} fill="red" />}
    </g>
  </>;
}, (prevProps, newProps) => {
  return jsonDeepEqual(prevProps.text, newProps)
    && prevProps.highlight === newProps.highlight
    && prevProps.onEdit === newProps.onEdit
    && prevProps.setModal === newProps.setModal
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
